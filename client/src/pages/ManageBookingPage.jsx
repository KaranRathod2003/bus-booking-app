import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import axios from 'axios'
import { socket, userId } from '../socket'
import { useToast } from '../context/ToastContext'
import BusCard from '../components/BusCard'
import SeatGrid from '../components/SeatGrid'
import SeatLegend from '../components/SeatLegend'
import PageTransition from '../components/PageTransition'

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getMaxDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const STEPS = ['Route & Date', 'Select Bus', 'Select Seat', 'Confirm']

export default function ManageBookingPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [pnr, setPnr] = useState('')
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showReschedule, setShowReschedule] = useState(false)
  const [step, setStep] = useState(0)
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState(getTomorrow())
  const [buses, setBuses] = useState([])
  const [selectedBus, setSelectedBus] = useState('')
  const [seats, setSeats] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)

  const currentBusRef = useRef(null)
  const currentDateRef = useRef(rescheduleDate)
  currentDateRef.current = rescheduleDate

  const joinBusRoom = useCallback((busId, date) => {
    if (currentBusRef.current && currentBusRef.current !== busId) {
      socket.emit('bus:leave', { busId: currentBusRef.current, date: currentDateRef.current })
    }
    currentBusRef.current = busId
    setSeats([])
    setSelectedSeat(null)
    socket.emit('bus:join', { busId, userId, date })
  }, [])

  useEffect(() => {
    const handleSnapshot = ({ busId: bId, seats: s }) => {
      if (bId === currentBusRef.current) {
        setSeats(s)
        const mine = s.find((seat) => seat.status === 'mine')
        if (mine) setSelectedSeat(mine.id)
      }
    }

    const handleUpdate = ({ busId: bId, seatId, status, lockedBy, lockType }) => {
      if (bId !== currentBusRef.current) return
      setSeats((prev) =>
        prev.map((s) => {
          if (s.id !== seatId) return s
          let newStatus = status
          if (status === 'held') {
            newStatus = lockedBy === userId ? 'mine' : 'held'
          } else if (status === 'locked') {
            newStatus = lockedBy === userId ? 'mine' : 'locked'
          }
          return { ...s, status: newStatus, lockedBy, lockType: lockType || null }
        })
      )
    }

    const handleExpired = ({ busId: bId, seatId }) => {
      if (bId !== currentBusRef.current) return
      setSeats((prev) =>
        prev.map((s) =>
          s.id === seatId ? { ...s, status: 'available', lockedBy: null, lockType: null, ttl: null } : s
        )
      )
      setSelectedSeat((prev) => (prev === seatId ? null : prev))
    }

    const handleSelectResult = ({ success: ok, seatId, error: err }) => {
      if (ok) {
        setSelectedSeat(seatId)
        setError('')
      } else {
        setError(err || 'Could not select seat')
      }
    }

    const handleReleaseResult = ({ success: ok, seatId }) => {
      if (ok) {
        setSelectedSeat((prev) => (prev === seatId ? null : prev))
      }
    }

    socket.on('seats:snapshot', handleSnapshot)
    socket.on('seat:updated', handleUpdate)
    socket.on('seat:expired', handleExpired)
    socket.on('seat:select:result', handleSelectResult)
    socket.on('seat:release:result', handleReleaseResult)

    return () => {
      socket.off('seats:snapshot', handleSnapshot)
      socket.off('seat:updated', handleUpdate)
      socket.off('seat:expired', handleExpired)
      socket.off('seat:select:result', handleSelectResult)
      socket.off('seat:release:result', handleReleaseResult)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (currentBusRef.current) {
        socket.emit('bus:leave', { busId: currentBusRef.current, date: currentDateRef.current })
        currentBusRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedSeat || !currentBusRef.current) return
    const interval = setInterval(() => {
      socket.emit('seat:select', {
        busId: currentBusRef.current,
        seatId: selectedSeat,
        userId,
        date: currentDateRef.current,
      })
    }, 20000)
    return () => clearInterval(interval)
  }, [selectedSeat])

  const handleSeatSelect = useCallback((seatId) => {
    const busId = currentBusRef.current
    if (!busId) return
    socket.emit('seat:select', { busId, seatId, userId, date: currentDateRef.current })
  }, [])

  const handleSeatRelease = useCallback((seatId) => {
    const busId = currentBusRef.current
    if (!busId) return
    socket.emit('seat:release', { busId, seatId, userId, date: currentDateRef.current })
  }, [])

  const handleLookup = async () => {
    if (!pnr.trim()) return
    setError('')
    setSuccess('')
    setTicket(null)
    setShowReschedule(false)
    resetReschedule()

    try {
      const res = await axios.get(`/api/tickets/${pnr.trim().toUpperCase()}`)
      setTicket(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Booking not found')
    }
  }

  const handleCancel = async () => {
    setError('')
    setSuccess('')
    try {
      const res = await axios.post('/api/cancel', { pnr: ticket.booking.pnr })
      setSuccess(
        `Booking cancelled. Penalty: \u20B9${res.data.penalty} (${res.data.penaltyPercent}%). Refund: \u20B9${res.data.refund}`
      )
      const updated = await axios.get(`/api/tickets/${ticket.booking.pnr}`)
      setTicket(updated.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Cancel failed')
    }
  }

  const resetReschedule = () => {
    if (currentBusRef.current) {
      socket.emit('bus:leave', { busId: currentBusRef.current, date: currentDateRef.current })
      currentBusRef.current = null
    }
    setStep(0)
    setSelectedRoute('')
    setRescheduleDate(getTomorrow())
    setBuses([])
    setSelectedBus('')
    setSeats([])
    setSelectedSeat(null)
  }

  const handleShowReschedule = async () => {
    resetReschedule()
    setShowReschedule(true)
    try {
      const res = await axios.get('/api/routes')
      setRoutes(res.data)
    } catch {
      setError('Failed to load routes')
    }
  }

  const handleRouteNext = async () => {
    if (!selectedRoute || !rescheduleDate) return
    setError('')
    try {
      const res = await axios.get(`/api/buses?routeId=${selectedRoute}`)
      setBuses(res.data)
      setStep(1)
    } catch {
      setError('Failed to load buses')
    }
  }

  const handleBusSelect = (busId) => {
    setSelectedBus(busId)
    joinBusRoom(busId, rescheduleDate)
    setStep(2)
  }

  const handleConfirmReschedule = async () => {
    if (!selectedBus || !selectedSeat) {
      setError('Please select a bus and seat')
      return
    }
    setError('')
    setSuccess('')
    try {
      const res = await axios.post('/api/reschedule', {
        pnr: ticket.booking.pnr,
        newBusId: selectedBus,
        newSeatId: selectedSeat,
        newDate: rescheduleDate,
        userId,
      })
      setSuccess(`Rescheduled! New PNR: ${res.data.newBooking.pnr}`)
      setShowReschedule(false)
      resetReschedule()
      addToast({ message: 'Booking rescheduled successfully!', type: 'success' })
      setTimeout(() => navigate(`/ticket/${res.data.newBooking.pnr}`), 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Reschedule failed')
    }
  }

  const selectedBusInfo = buses.find((b) => b.id === selectedBus)
  const selectedRouteInfo = routes.find((r) => r.id === selectedRoute)

  return (
    <PageTransition>
      <h2 className="page-title">Manage Booking</h2>

      {/* PNR Lookup */}
      <div className="card">
        <div className="form-group">
          <label>Enter PNR</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="e.g. PNRAB3F2X"
              style={{ textTransform: 'uppercase' }}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
            <button className="btn btn-primary" onClick={handleLookup}>
              Look Up
            </button>
          </div>
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}
      {success && <div className="message message-success">{success}</div>}

      {/* Booking Details */}
      {ticket && (
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Booking Details</h3>
          <div className="ticket-body" style={{ padding: 0 }}>
            <div className="ticket-row">
              <div>
                <div className="ticket-label">PNR</div>
                <div className="ticket-value">{ticket.booking.pnr}</div>
              </div>
              <div>
                <div className="ticket-label">Status</div>
                <div className="ticket-value" style={{
                  color: ticket.booking.status === 'confirmed' ? 'var(--color-available)' : 'var(--color-booked)'
                }}>
                  {ticket.booking.status.toUpperCase()}
                </div>
              </div>
            </div>
            <div className="ticket-row">
              <div>
                <div className="ticket-label">Route</div>
                <div className="ticket-value">{ticket.route?.source} → {ticket.route?.destination}</div>
              </div>
            </div>
            <div className="ticket-row">
              <div>
                <div className="ticket-label">Bus</div>
                <div className="ticket-value">{ticket.bus?.name}</div>
              </div>
              <div>
                <div className="ticket-label">Seat</div>
                <div className="ticket-value">{ticket.booking.seatId}</div>
              </div>
            </div>
            <div className="ticket-row">
              <div>
                <div className="ticket-label">Passenger</div>
                <div className="ticket-value">{ticket.booking.passengerName}</div>
              </div>
              <div>
                <div className="ticket-label">Price</div>
                <div className="ticket-value">{'\u20B9'}{ticket.booking.price}</div>
              </div>
            </div>
          </div>

          {ticket.booking.status === 'confirmed' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-danger" onClick={handleCancel}>
                Cancel Booking
              </button>
              <button className="btn btn-primary" onClick={handleShowReschedule}>
                Reschedule
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reschedule Flow */}
      {showReschedule && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Reschedule Booking</h3>

          {/* Step Indicator */}
          <div className="reschedule-steps">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`reschedule-step${i === step ? ' reschedule-step-active' : ''}${i < step ? ' reschedule-step-completed' : ''}`}
              >
                <div className="reschedule-step-number">
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Step 0: Route & Date */}
          {step === 0 && (
            <div>
              <div className="form-group">
                <label>Select Route</label>
                <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
                  <option value="">Select route</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.source} → {r.destination}</option>
                  ))}
                </select>
              </div>
              <div className="form-group date-picker-group">
                <label>Travel Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={getToday()}
                  max={getMaxDate()}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleRouteNext}
                disabled={!selectedRoute || !rescheduleDate}
              >
                Next: Select Bus
              </button>
            </div>
          )}

          {/* Step 1: Bus Selection */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                {selectedRouteInfo && `${selectedRouteInfo.source} → ${selectedRouteInfo.destination}`} &middot; {rescheduleDate}
              </p>
              {buses.length === 0 ? (
                <div className="message message-info">No buses available for this route.</div>
              ) : (
                buses.map((bus) => (
                  <div
                    key={bus.id}
                    className={selectedBus === bus.id ? 'bus-card-selectable bus-card-selected' : 'bus-card-selectable'}
                  >
                    <BusCard
                      bus={bus}
                      onClick={() => handleBusSelect(bus.id)}
                    />
                  </div>
                ))
              )}
              <button
                className="btn btn-primary"
                onClick={() => { setStep(0); setSelectedBus(''); setSeats([]); setSelectedSeat(null) }}
                style={{ marginTop: '12px' }}
              >
                Back
              </button>
            </div>
          )}

          {/* Step 2: Seat Selection */}
          {step === 2 && (
            <div className="reschedule-layout">
              <div>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                  {selectedBusInfo?.name} &middot; {rescheduleDate}
                </p>
                <SeatLegend />
                <SeatGrid seats={seats} onSelect={handleSeatSelect} onRelease={handleSeatRelease} />
              </div>
              <div>
                <div className="sidebar-card">
                  <h3>Reschedule Summary</h3>
                  {selectedRouteInfo && (
                    <div className="summary-row">
                      <span className="summary-label">Route</span>
                      <span className="summary-value">{selectedRouteInfo.source} → {selectedRouteInfo.destination}</span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span className="summary-label">Date</span>
                    <span className="summary-value">{rescheduleDate}</span>
                  </div>
                  {selectedBusInfo && (
                    <>
                      <div className="summary-row">
                        <span className="summary-label">Bus</span>
                        <span className="summary-value">{selectedBusInfo.name}</span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Price</span>
                        <span className="summary-value">{'\u20B9'}{selectedBusInfo.price}</span>
                      </div>
                    </>
                  )}
                  {selectedSeat ? (
                    <>
                      <div className="summary-row">
                        <span className="summary-label">Seat</span>
                        <span className="summary-value summary-highlight">{selectedSeat}</span>
                      </div>
                      <div className="summary-divider" />
                      <button
                        className="btn btn-success"
                        onClick={() => setStep(3)}
                        style={{ width: '100%' }}
                      >
                        Review & Confirm
                      </button>
                    </>
                  ) : (
                    <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '12px' }}>
                      Select a seat to continue
                    </p>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => { setStep(1); setSelectedSeat(null) }}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  Back to Bus Selection
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div>
              <div className="card booking-summary" style={{ marginBottom: '16px' }}>
                <h3 className="summary-title">Confirm Reschedule</h3>
                {selectedRouteInfo && (
                  <div className="summary-row">
                    <span className="summary-label">Route</span>
                    <span className="summary-value">{selectedRouteInfo.source} → {selectedRouteInfo.destination}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="summary-label">Date</span>
                  <span className="summary-value">{rescheduleDate}</span>
                </div>
                {selectedBusInfo && (
                  <>
                    <div className="summary-row">
                      <span className="summary-label">Bus</span>
                      <span className="summary-value">{selectedBusInfo.name}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Schedule</span>
                      <span className="summary-value">{selectedBusInfo.departure} → {selectedBusInfo.arrival}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Price</span>
                      <span className="summary-value">{'\u20B9'}{selectedBusInfo.price}</span>
                    </div>
                  </>
                )}
                <div className="summary-row">
                  <span className="summary-label">Seat</span>
                  <span className="summary-value summary-highlight">{selectedSeat}</span>
                </div>
                <div className="summary-divider" />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setStep(2)}
                    style={{ flex: 1 }}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleConfirmReschedule}
                    style={{ flex: 2 }}
                  >
                    Confirm Reschedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  )
}
