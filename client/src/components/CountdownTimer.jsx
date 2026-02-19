import { useState, useEffect, useRef } from 'react'

export function useLockTimer(ttl, onExpired) {
  const [secondsRemaining, setSecondsRemaining] = useState(ttl ?? null)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (ttl == null) {
      setSecondsRemaining(null)
      expiredRef.current = false
      return
    }
    setSecondsRemaining(ttl)
    expiredRef.current = false
  }, [ttl])

  useEffect(() => {
    if (secondsRemaining == null) return
    if (secondsRemaining <= 0 && !expiredRef.current) {
      expiredRef.current = true
      onExpired?.()
      return
    }
    if (secondsRemaining <= 0) return
    const timer = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsRemaining, onExpired])

  return { secondsRemaining }
}
