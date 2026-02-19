import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { socket, userId } from '../socket'
import { useLockTimer } from '../components/CountdownTimer'
import { useToast } from '../context/ToastContext'
import api from '../utils/api'
import PageTransition from '../components/PageTransition'

function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PaymentPage() {
  const { busId, seatId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const { addToast } = useToast()

  const [lockLoading, setLockLoading] = useState(true)
  const [lockAcquired, setLockAcquired] = useState(false)
  const [ttl, setTtl] = useState(null)

  const [passengerName, setPassengerName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seatInfo, setSeatInfo] = useState(null)

  const handleExpired = useCallback(() => {
    addToast({ message: 'Seat reservation expired. Redirecting to seat selection...', type: 'warning', duration: 4000 })
    setTimeout(() => navigate(`/seats/${busId}?date=${date}`), 2000)
  }, [addToast, navigate, busId, date])

  const { secondsRemaining } = useLockTimer(ttl, handleExpired)

  useEffect(() => {
    const acquireLock = async () => {
      try {
        const res = await api.post(`/api/buses/${busId}/seats/lock`, {
          seatId,
          userId,
          date,
        })
        setTtl(res.data.ttl)
        setLockAcquired(true)
        setLockLoading(false)
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to acquire seat lock')
        setLockLoading(false)
        addToast({ message: 'Could not lock seat. Redirecting...', type: 'error', duration: 3000 })
        setTimeout(() => navigate(`/seats/${busId}?date=${date}`), 3000)
      }
    }
    acquireLock()
  }, [busId, seatId, date, addToast, navigate])

  useEffect(() => {
    if (!lockAcquired) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lockAcquired]);

  const handleBack = async (e) => {
    e.preventDefault();
    const confirmed = window.confirm("You'll lose your seat reservation. Continue?");
    if (!confirmed) return;
    try {
      await api.post(`/api/buses/${busId}/seats/unlock`, { seatId, userId, date });
    } catch {
      // Best-effort
    }
    navigate(`/seats/${busId}?date=${date}`);
  };

  useEffect(() => {
    socket.emit('bus:join', { busId, userId, date })

    const handleSeatExpired = ({ busId: bId, seatId: sId }) => {
      if (bId === busId && sId === seatId) {
        addToast({ message: 'Seat reservation expired. Redirecting...', type: 'warning' })
        setTimeout(() => navigate(`/seats/${busId}?date=${date}`), 2000)
      }
    }

    socket.on('seat:expired', handleSeatExpired)

    return () => {
      socket.emit('bus:leave', { busId, date })
      socket.off('seat:expired', handleSeatExpired)
    }
  }, [busId, seatId, date, addToast, navigate])

  useEffect(() => {
    const load = async () => {
      try {
        const busRes = await api.get(`/api/buses/${busId}`)
        const bus = busRes.data
        if (bus) {
          setSeatInfo({
            busName: bus.name,
            busType: bus.type,
            price: bus.price,
            departure: bus.departure,
            arrival: bus.arrival,
            operator: bus.operator?.name,
          })
        }
      } catch {
        // Non-critical
      }
    }
    load()
  }, [busId])

  const handleConfirm = async () => {
    if (!passengerName.trim() || !phone.trim()) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await api.post('/api/book', {
        busId,
        seatId,
        userId,
        passengerName: passengerName.trim(),
        phone: phone.trim(),
        date,
      })

      socket.emit('bus:join', { busId, userId, date })
      addToast({ message: 'Booking confirmed!', type: 'success' })
      navigate(`/ticket/${res.data.booking.pnr}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  if (lockLoading) {
    return (
      <PageTransition>
        <div className="payment-page">
          <h2 className="page-title">Securing Your Seat...</h2>
          <p className="page-subtitle">Acquiring lock on Seat {seatId} for Bus {busId}</p>
          <div className="loading">Please wait...</div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="payment-page">
        <h2 className="page-title">Complete Your Booking</h2>
        <p className="page-subtitle">Seat {seatId} on Bus {busId}</p>

        {lockAcquired && secondsRemaining != null && (
          <div className="payment-timer">
            <span className="payment-timer-label">Time remaining</span>
            <span className={`payment-timer-value${secondsRemaining <= 60 ? ' payment-timer-urgent' : ''}`}>
              {formatTime(secondsRemaining)}
            </span>
          </div>
        )}

        <div className="payment-layout">
          {seatInfo && (
            <div className="card booking-summary">
              <h3 className="summary-title">Booking Summary</h3>
              <div className="summary-row">
                <span className="summary-label">Bus</span>
                <span className="summary-value">{seatInfo.busName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Type</span>
                <span className="summary-value">{seatInfo.busType}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Operator</span>
                <span className="summary-value">{seatInfo.operator}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Seat</span>
                <span className="summary-value summary-highlight">{seatId}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Date</span>
                <span className="summary-value">{date}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Schedule</span>
                <span className="summary-value">{seatInfo.departure} → {seatInfo.arrival}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-row summary-total">
                <span className="summary-label">Total</span>
                <span className="summary-value">₹{seatInfo.price}</span>
              </div>
            </div>
          )}

          <div className="card payment-form-card">
            {error && <div className="message message-error">{error}</div>}

            <div className="form-group">
              <label>Passenger Name</label>
              <input
                type="text"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                placeholder="Enter full name"
                disabled={!lockAcquired}
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                disabled={!lockAcquired}
              />
            </div>

            <button
              className="btn btn-success"
              onClick={handleConfirm}
              disabled={loading || !lockAcquired || !!error}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading ? 'Processing...' : 'Confirm & Pay'}
            </button>

            <div className="nav-links">
              <a href="#" onClick={handleBack}>
                <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Back to Seat Selection
              </a>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
