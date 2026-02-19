import { useState, useEffect } from 'react'
import { onConnectionChange, isConnected } from '../socket'

export default function LiveBadge() {
  const [connected, setConnected] = useState(isConnected())

  useEffect(() => {
    return onConnectionChange(setConnected)
  }, [])

  return (
    <div className={`live-badge ${connected ? 'live-badge-connected' : 'live-badge-disconnected'}`}>
      <div className={`live-dot ${connected ? 'live-dot-green' : 'live-dot-red'}`} />
      {connected ? 'LIVE' : 'OFFLINE'}
    </div>
  )
}
