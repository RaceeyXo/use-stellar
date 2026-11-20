import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import { fundWithFriendbot, offlineError, onlineManager, toStellarError, type StellarError } from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseFriendBotReturn { fund: (address?: string) => Promise<void>; loading: Ref<boolean>; error: ShallowRef<StellarError | null>; funded: Ref<boolean>; reset: () => void }

export function useFriendBot(): UseFriendBotReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false), funded = ref(false)
  const error = shallowRef<StellarError | null>(null)
  let operation = 0, disposed = false
  async function fund(address?: string) {
    if (!onlineManager.isOnline()) throw offlineError()
    const id = ++operation; loading.value = true; funded.value = false; error.value = null
    try { await fundWithFriendbot(runtime, address); if (!disposed && id === operation) funded.value = true }
    catch (cause) { if (!disposed && id === operation) error.value = toStellarError(cause); throw cause }
    finally { if (!disposed && id === operation) loading.value = false }
  }
  const reset = () => { operation += 1; loading.value = false; funded.value = false; error.value = null }
  onScopeDispose(() => { disposed = true; operation += 1 })
  return { fund, loading, error, funded, reset }
}
