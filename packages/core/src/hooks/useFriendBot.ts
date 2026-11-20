import { useCallback, useEffect, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { fundWithFriendbot } from "../actions/friendbot"
import { toStellarError, type StellarError } from "../errors"
import type { UseFriendbotReturn } from "../types"

export function useFriendbot(): UseFriendbotReturn {
  const runtime = useStellarContext()
  const mounted = useRef(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [funded, setFunded] = useState(false)
  useEffect(() => () => { mounted.current = false }, [])
  const fund = useCallback(async (address?: string) => {
    setLoading(true); setError(null); setFunded(false)
    try { await fundWithFriendbot(runtime, address); if (mounted.current) setFunded(true) }
    catch (cause) { const next = toStellarError(cause); if (mounted.current) setError(next); throw next }
    finally { if (mounted.current) setLoading(false) }
  }, [runtime])
  return { fund, loading, error, funded }
}
