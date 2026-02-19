import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, Lightbulb, X } from 'lucide-react'
import { socket, userId } from '../socket'
import SeatGrid from '../components/SeatGrid'
import SeatLegend from '../components/SeatLegend'
import ActivityFeed from '../components/ActivityFeed'
import PageTransition from '../components/PageTransition'

let activityId = 0

export default function SeatMapPage() {
  const { busId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const [seats, setSeats] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [error, setError] = useState('')
  const [viewerCount, setViewerCount] = useState(0)
  const [showBanner, setShowBanner] = useState(true)
  const [activity, setActivity] = useState([])

  const addActivity = useCallback((message, dotColor) => {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setActivity((prev) => {
      const next = [{ id: ++activityId, message, dotColor, time }, ...prev]
      return next.slice(0, 5)
    })
  }, [])

  useEffect(() => {
    socket.emit('bus:join', { busId, userId, date })

    const handleSnapshot = ({ busId: bId, seats: s }) => {
      if (bId === busId) {
        setSeats(s)
        const mine = s.find((seat) => seat.status === 'mine')
        if (mine) setSelectedSeat(mine.id)
      }
    }

    const handleUpdate = ({ busId: bId, seatId, status, lockedBy, lockType, ttl }) => {
      if (bId !== busId) return
      setSeats((prev) =>
        prev.map((s) => {
          if (s.id !== seatId) return s
          let newStatus = status
          if (status === 'held') {
            newStatus = lockedBy === userId ? 'mine' : 'held'
          } else if (status === 'locked') {
            newStatus = lockedBy === userId ? 'mine' : 'locked'
          }
          return { ...s, status: newStatus, lockedBy, lockType: lockType || null, ttl }
        })
      )

      if (lockedBy !== userId) {
        if (status === 'held') {
          addActivity(`Seat ${seatId} is being viewed by another user`, 'locked')
        } else if (status === 'locked') {
          addActivity(`Seat ${seatId} locked for payment`, 'locked')
        } else if (status === 'booked') {
          addActivity(`Seat ${seatId} has been booked`, 'booked')
        } else if (status === 'available') {
          addActivity(`Seat ${seatId} is now available`, 'available')
        }
      }

      if (status === 'booked' && lockedBy === null) {
        setSelectedSeat((prev) => (prev === seatId ? null : prev))
      }
    }

    const handleExpired = ({ busId: bId, seatId }) => {
      if (bId !== busId) return
      setSeats((prev) =>
        prev.map((s) =>
          s.id === seatId ? { ...s, status: 'available', lockedBy: null, lockType: null, ttl: null } : s
        )
      )
      setSelectedSeat((prev) => (prev === seatId ? null : prev))
      addActivity(`Seat ${seatId} lock expired — now available`, 'available')
    }

    const handleSelectResult = ({ success, seatId, error: err }) => {
      if (success) {
        setSelectedSeat(seatId)
        setError('')
      } else {
        setError(err || 'Could not select seat')
      }
    }

    const handleReleaseResult = ({ success, seatId }) => {
      if (success) {
        setSelectedSeat((prev) => (prev === seatId ? null : prev))
      }
    }

    const handleViewers = ({ busId: bId, count }) => {
      if (bId === busId) setViewerCount(count)
    }

    socket.on('seats:snapshot', handleSnapshot)
    socket.on('seat:updated', handleUpdate)
    socket.on('seat:expired', handleExpired)
    socket.on('seat:select:result', handleSelectResult)
    socket.on('seat:release:result', handleReleaseResult)
    socket.on('bus:viewers', handleViewers)

    return () => {
      socket.emit('bus:leave', { busId, date })
      socket.off('seats:snapshot', handleSnapshot)
      socket.off('seat:updated', handleUpdate)
      socket.off('seat:expired', handleExpired)
      socket.off('seat:select:result', handleSelectResult)
      socket.off('seat:release:result', handleReleaseResult)
      socket.off('bus:viewers', handleViewers)
    }
  }, [busId, date, addActivity])

  useEffect(() => {
    if (!selectedSeat) return
    const interval = setInterval(() => {
      socket.emit('seat:select', { busId, seatId: selectedSeat, userId, date })
    }, 20000)
    return () => clearInterval(interval)
  }, [busId, date, selectedSeat])

  const handleSelect = useCallback((seatId) => {
    socket.emit('seat:select', { busId, seatId, userId, date })
  }, [busId, date])

  const handleRelease = useCallback((seatId) => {
    socket.emit('seat:release', { busId, seatId, userId, date })
  }, [busId, date])

  const handleProceed = () => {
    if (selectedSeat) {
      navigate(`/payment/${busId}/${selectedSeat}?date=${date}`)
    }
  }

  return (
    <PageTransition>
      <div className="seatmap-header">
        <div>
          <h2 className="page-title">Select Your Seat</h2>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Bus {busId} &middot; {date}</p>
        </div>
        <div className="viewer-count">
          <span className="viewer-icon"><Eye size={16} /></span>
          {viewerCount} {viewerCount === 1 ? 'user' : 'users'} viewing
        </div>
      </div>

      {showBanner && (
        <div className="demo-banner">
          <span className="demo-banner-text">
            <Lightbulb size={16} /> Open this page in another tab to see real-time seat locking in action
          </span>
          <button className="demo-banner-close" onClick={() => setShowBanner(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && <div className="message message-error">{error}</div>}

      <div className="seatmap-layout">
        <div className="seatmap-main">
          <SeatLegend />
          <SeatGrid seats={seats} onSelect={handleSelect} onRelease={handleRelease} />
        </div>

        <div className="seatmap-sidebar">
          <div className="sidebar-card">
            <h3>Booking</h3>
            {selectedSeat ? (
              <>
                <div className="selected-seat-info" style={{ marginBottom: '12px' }}>
                  <span>Seat {selectedSeat}</span>
                </div>
                <button className="btn btn-primary" onClick={handleProceed} style={{ width: '100%' }}>
                  Proceed to Payment
                </button>
              </>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                Select an available seat to continue
              </p>
            )}
          </div>

          <div className="sidebar-card">
            <h3>Live Activity</h3>
            <ActivityFeed events={activity} />
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
