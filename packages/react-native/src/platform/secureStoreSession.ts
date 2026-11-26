import { createInMemoryStorage, type Storage } from "./asyncStorageSession"

interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}
interface Group {
  id: string
  count: number
}
interface Manifest {
  version: 1
  active: Group | null
  pending: Group | null
}
const CHUNK_BYTES = 1800
const MAX_CHUNKS = 1024
let generation = 0

/** Optional peer: never required when importing the package. */
export function loadSecureStore(): SecureStoreLike | null {
  try {
    // Literal optional require is also understood by Metro.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-secure-store")
    const store = (mod?.default ?? mod) as SecureStoreLike | undefined
    return store &&
      typeof store.getItemAsync === "function" &&
      typeof store.setItemAsync === "function" &&
      typeof store.deleteItemAsync === "function"
      ? store
      : null
  } catch {
    return null
  }
}

// Encode arbitrary Web Storage keys using only SecureStore's allowed characters.
function storageKey(key: string): string {
  let encoded = "use-stellar.session."
  for (let i = 0; i < key.length; i++) encoded += key.charCodeAt(i).toString(16).padStart(4, "0")
  return encoded
}
function split(value: string): string[] {
  const chunks: string[] = []
  let chunk = ""
  let bytes = 0
  // JSON escapes lone surrogates, preserving every JS string on round-trip.
  for (const character of JSON.stringify(value)) {
    const point = character.codePointAt(0)!
    const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
    if (bytes + size > CHUNK_BYTES) {
      chunks.push(chunk)
      chunk = ""
      bytes = 0
    }
    chunk += character
    bytes += size
  }
  chunks.push(chunk)
  if (chunks.length > MAX_CHUNKS)
    throw new Error("Secure session exceeds the supported storage size")
  return chunks
}
function validGroup(value: unknown): value is Group | null {
  if (value === null) return true
  if (!value || typeof value !== "object") return false
  const group = value as Group
  return (
    typeof group.id === "string" &&
    /^[a-z0-9-]{1,100}$/.test(group.id) &&
    Number.isInteger(group.count) &&
    group.count > 0 &&
    group.count <= MAX_CHUNKS
  )
}
function decode(raw: string | null): Manifest {
  if (raw === null) return { version: 1, active: null, pending: null }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== "object") throw new Error("Invalid secure session metadata")
  const manifest = value as Manifest
  if (manifest.version !== 1 || !validGroup(manifest.active) || !validGroup(manifest.pending))
    throw new Error("Invalid secure session metadata")
  return manifest
}
function chunkKey(key: string, group: Group, index: number): string {
  return key + "." + group.id + "." + index
}

// Serialize same-key operations, including separate adapters in this JS runtime.
const queues = new Map<string, Promise<unknown>>()
function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve()
  const promise = previous.catch(() => undefined).then(task)
  queues.set(key, promise)
  const release = () => {
    if (queues.get(key) === promise) queues.delete(key)
  }
  promise.then(release, release)
  return promise
}

/**
 * Opt-in encrypted persistence using Expo SecureStore (Keychain/Keystore).
 * Missing/unlinked peer uses isolated memory; native operation errors propagate.
 * Values are chunked conservatively below historical native 2 KiB limits.
 */
export function createSecureStoreAdapter(): Storage {
  const store = loadSecureStore()
  if (!store) return createInMemoryStorage()
  const native = store
  async function erase(key: string, group: Group | null): Promise<void> {
    if (group)
      for (let i = 0; i < group.count; i++) await native.deleteItemAsync(chunkKey(key, group, i))
  }
  const save = (key: string, manifest: Manifest) =>
    native.setItemAsync(key, JSON.stringify(manifest))
  return {
    getItem(key) {
      const encoded = storageKey(key)
      return serialized(encoded, async () => {
        const { active } = decode(await native.getItemAsync(encoded))
        if (!active) return null
        const chunks: string[] = []
        for (let i = 0; i < active.count; i++) {
          const chunk = await native.getItemAsync(chunkKey(encoded, active, i))
          if (chunk === null) return null // Never return a partially persisted session.
          chunks.push(chunk)
        }
        let value: unknown
        try {
          value = JSON.parse(chunks.join(""))
        } catch {
          throw new Error("Invalid secure session value")
        }
        if (typeof value !== "string") throw new Error("Invalid secure session value")
        return value
      })
    },
    setItem(key, value) {
      // Validate size before touching an existing session.
      const chunks = split(value)
      const encoded = storageKey(key)
      return serialized(encoded, async () => {
        const manifest = decode(await native.getItemAsync(encoded))
        // Retry cleanup left by an interrupted/failed previous write first.
        if (manifest.pending) {
          await erase(encoded, manifest.pending)
          manifest.pending = null
          await save(encoded, manifest)
        }
        const next: Group = {
          id:
            Date.now().toString(36) +
            "-" +
            (++generation).toString(36) +
            "-" +
            Math.random().toString(36).slice(2),
          count: chunks.length,
        }
        // Journal every chunk before writing it, so removal can erase even an
        // incomplete write. Keep the old session active until all chunks exist.
        await save(encoded, { version: 1, active: manifest.active, pending: next })
        for (let i = 0; i < chunks.length; i++)
          await native.setItemAsync(chunkKey(encoded, next, i), chunks[i])
        await save(encoded, { version: 1, active: next, pending: manifest.active })
        await erase(encoded, manifest.active)
        await save(encoded, { version: 1, active: next, pending: null })
      })
    },
    removeItem(key) {
      const encoded = storageKey(key)
      return serialized(encoded, async () => {
        const manifest = decode(await native.getItemAsync(encoded))
        await erase(encoded, manifest.pending)
        await erase(encoded, manifest.active)
        // Metadata is removed last: failed deletions retain references for retry.
        await native.deleteItemAsync(encoded)
      })
    },
  }
}
