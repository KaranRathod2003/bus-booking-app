import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../utils/api'
import QRTicket from '../components/QRTicket'
import PageTransition from '../components/PageTransition'

export default function TicketPage() {
  const { pnr } = useParams()
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const fetchTicket = async (retries = 3) => {
      setError('')
      for (let i = 0; i < retries; i++) {
        try {
          const res = await api.get(`/api/tickets/${pnr}`)
          if (!cancelled) setTicket(res.data)
          return
        } catch (err) {
          if (i < retries - 1) {
            await new Promise((r) => setTimeout(r, 600))
          } else if (!cancelled) {
            setError(err.response?.data?.error || 'Ticket not found')
          }
        }
      }
    }

    fetchTicket()
    return () => { cancelled = true }
  }, [pnr])

  if (error) return <div className="message message-error">{error}</div>
  if (!ticket) return <div className="loading">Loading ticket...</div>

  const { booking, bus, route, operator, qrPayload } = ticket

  return (
    <PageTransition>
      <h2 className="page-title">Booking {booking.status === 'confirmed' ? 'Confirmed' : booking.status}</h2>

      <div className="ticket">
        <div className="ticket-header">
          <h2>{operator?.name || 'Bus Operator'}</h2>
        </div>

        <div className="ticket-pnr">{booking.pnr}</div>

        {route && (
          <>
            <div className="ticket-route-visual">
              <span className="ticket-route-city">{route.source}</span>
              <div className="ticket-route-dot" />
              <div className="ticket-route-line" />
              <div className="ticket-route-dot" />
              <span className="ticket-route-city">{route.destination}</span>
            </div>
            <hr className="ticket-divider" />
          </>
        )}

        <div className="ticket-body">
          <div className="ticket-row">
            <div>
              <div className="ticket-label">Bus</div>
              <div className="ticket-value">{bus?.name} ({bus?.type})</div>
            </div>
          </div>
          <div className="ticket-row">
            <div>
              <div className="ticket-label">Seat</div>
              <div className="ticket-value">{booking.seatId}</div>
            </div>
            <div>
              <div className="ticket-label">Date</div>
              <div className="ticket-value">{booking.date}</div>
            </div>
          </div>
          <div className="ticket-row">
            <div>
              <div className="ticket-label">Departure</div>
              <div className="ticket-value">{bus?.departure}</div>
            </div>
            <div>
              <div className="ticket-label">Arrival</div>
              <div className="ticket-value">{bus?.arrival}</div>
            </div>
          </div>
          <div className="ticket-row">
            <div>
              <div className="ticket-label">Passenger</div>
              <div className="ticket-value">{booking.passengerName}</div>
            </div>
            <div>
              <div className="ticket-label">Phone</div>
              <div className="ticket-value">{booking.phone}</div>
            </div>
          </div>
          <div className="ticket-row">
            <div>
              <div className="ticket-label">Price</div>
              <div className="ticket-value">₹{booking.price}</div>
            </div>
            <div>
              <div className="ticket-label">Status</div>
              <div className="ticket-value" style={{
                color: booking.status === 'confirmed' ? 'var(--color-available)' :
                       booking.status === 'cancelled' ? 'var(--color-booked)' : 'var(--color-locked)'
              }}>
                {booking.status.toUpperCase()}
              </div>
            </div>
          </div>
          {booking.refund != null && (
            <div className="ticket-row">
              <div>
                <div className="ticket-label">Penalty</div>
                <div className="ticket-value">₹{booking.penalty}</div>
              </div>
              <div>
                <div className="ticket-label">Refund</div>
                <div className="ticket-value" style={{ color: 'var(--color-available)' }}>₹{booking.refund}</div>
              </div>
            </div>
          )}
        </div>

        <QRTicket payload={qrPayload} />
      </div>

      <div className="nav-links" style={{ marginTop: '20px' }}>
        <Link to="/">Book Another</Link>
        <Link to="/manage">Manage Booking</Link>
      </div>
    </PageTransition>
  )
}
