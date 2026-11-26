import { computed, onScopeDispose, ref, shallowRef, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import { authenticateSep10, decodeSep10Expiry, offlineError, onlineManager, toStellarError, type StellarError } from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseSep10AuthOptions { homeDomain: MaybeRefOrGetter<string>; account?: MaybeRefOrGetter<string | null | undefined>; memo?: MaybeRefOrGetter<string | undefined>; clientDomain?: MaybeRefOrGetter<string | undefined> }
export interface UseSep10AuthReturn { token: ComputedRef<string | null>; expiresAt: ComputedRef<Date | null>; authenticated: ComputedRef<boolean>; loading: ComputedRef<boolean>; error: ComputedRef<StellarError | null>; authenticate: () => Promise<string>; logout: () => void; reset: () => void }

export function useSep10Auth(options: UseSep10AuthOptions): UseSep10AuthReturn {
  const runtime = useStellarRuntime()
  const token = shallowRef<string | null>(null), error = shallowRef<StellarError | null>(null)
  const loading = ref(false)
  let operation = 0, disposed = false
  async function authenticate() {
    if (!onlineManager.isOnline()) throw offlineError()
    const id = ++operation; loading.value = true; error.value = null
    try {
      const result = await authenticateSep10(runtime, { homeDomain: toValue(options.homeDomain), account: toValue(options.account) ?? undefined, memo: toValue(options.memo), clientDomain: toValue(options.clientDomain) })
      if (!disposed && id === operation) token.value = result
      return result
    } catch (cause) {
      if (!disposed && id === operation) error.value = toStellarError(cause)
      throw cause
    } finally { if (!disposed && id === operation) loading.value = false }
  }
  const logout = () => { operation += 1; token.value = null; error.value = null; loading.value = false }
  onScopeDispose(() => { disposed = true; operation += 1 })
  const expiresAt = computed(() => token.value ? decodeSep10Expiry(token.value) : null)
  return { token: computed(() => token.value), expiresAt, authenticated: computed(() => Boolean(token.value && (!expiresAt.value || expiresAt.value > new Date()))), loading: computed(() => loading.value), error: computed(() => error.value), authenticate, logout, reset: logout }
}
