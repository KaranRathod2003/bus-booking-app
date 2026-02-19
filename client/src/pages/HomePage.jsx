import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Zap, ShieldCheck, Wifi, Radio, Shield, Timer, Cpu, RefreshCw, Activity, GitBranch, Layers } from 'lucide-react'
import axios from 'axios'
import RouteSelector from '../components/RouteSelector'
import PageTransition from '../components/PageTransition'

const row1Pills = [
  { icon: Lock, text: 'Real-Time Locking' },
  { icon: Wifi, text: 'WebSocket Powered' },
  { icon: Zap, text: 'Instant Updates' },
  { icon: Radio, text: 'Live Sync' },
  { icon: RefreshCw, text: 'No Stale Data' },
  { icon: Layers, text: 'Multi-Device' },
  { icon: Timer, text: 'Auto-Expiry' },
  { icon: Cpu, text: 'Sub-Second Latency' },
]

const row2Pills = [
  { icon: ShieldCheck, text: 'Secure Booking' },
  { icon: Shield, text: 'Atomic Redis Locks' },
  { icon: Lock, text: 'No Double Bookings' },
  { icon: Activity, text: 'Race-Condition Free' },
  { icon: Radio, text: 'Heartbeat Monitoring' },
  { icon: Timer, text: 'Auto-Release' },
  { icon: GitBranch, text: 'Event-Driven' },
  { icon: RefreshCw, text: 'Conflict-Free' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [routes, setRoutes] = useState([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const [searchDate, setSearchDate] = useState('')

  const handleSearch = async (source, destination, date) => {
    try {
      setError('')
      setSearchDate(date)
      const res = await axios.get(`/api/routes?source=${source}&destination=${destination}`)
      setRoutes(res.data)
      setSearched(true)
      if (res.data.length === 1) {
        navigate(`/buses/${res.data[0].id}?date=${date}`)
      }
    } catch {
      setError('Failed to search routes')
    }
  }

  return (
    <PageTransition>
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">Book Bus Seats in Real-Time</h1>
        <p className="hero-tagline">
          WebSocket-powered seat selection with instant updates across all devices. No double bookings, no stale data.
        </p>
      </div>

      {/* Marquee Section */}
      <div className="marquee-section">
        <div className="marquee">
          <div className="marquee-track marquee-left">
            {[...row1Pills, ...row1Pills].map((pill, i) => (
              <span className="marquee-pill" key={i}>
                <pill.icon size={14} />
                {pill.text}
              </span>
            ))}
          </div>
        </div>
        <div className="marquee">
          <div className="marquee-track marquee-right">
            {[...row2Pills, ...row2Pills].map((pill, i) => (
              <span className="marquee-pill" key={i}>
                <pill.icon size={14} />
                {pill.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Search Card */}
      <div className="card">
        <h3 style={{ marginBottom: '16px', color: 'var(--color-text)', fontWeight: 700 }}>Find Your Bus</h3>
        <RouteSelector onSearch={handleSearch} />
      </div>

      {error && <div className="message message-error">{error}</div>}

      {searched && routes.length === 0 && (
        <div className="message message-info">No routes found for this combination.</div>
      )}

      {routes.length > 1 && (
        <div>
          <h3 style={{ margin: '16px 0 8px', fontWeight: 700, color: 'var(--color-text)' }}>Select a route:</h3>
          {routes.map((route) => (
            <div
              key={route.id}
              className="bus-card"
              onClick={() => navigate(`/buses/${route.id}?date=${searchDate}`)}
            >
              <div className="bus-info">
                <h3>{route.source} → {route.destination}</h3>
                <p>{route.distance} km &middot; {route.duration}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageTransition>
  )
}
