import { CircleUserRound } from 'lucide-react'
import Seat from './Seat'

const COL_LABELS = ['A', 'B', '', 'C', 'D']

export default function SeatGrid({ seats, onSelect, onRelease }) {
  if (!seats || seats.length === 0) return <div className="loading">Loading seats...</div>

  // Group seats by row
  const rows = {}
  seats.forEach((seat) => {
    if (!rows[seat.row]) rows[seat.row] = []
    rows[seat.row].push(seat)
  })

  // Sort each row by col
  Object.values(rows).forEach((row) => row.sort((a, b) => a.col - b.col))

  const sortedRowKeys = Object.keys(rows).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="bus-outline">
      {/* Windshield / Driver area */}
      <div className="bus-windshield">
        <span className="bus-windshield-label">Driver</span>
        <div className="bus-driver-icon"><CircleUserRound size={18} /></div>
      </div>

      {/* Column labels */}
      <div className="bus-column-labels">
        <div className="seat-row-number" />
        {COL_LABELS.map((label, idx) => (
          <div
            key={idx}
            className={`bus-column-label${label === '' ? ' aisle-spacer' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Seat grid */}
      <div className="seat-grid">
        {sortedRowKeys.map((rowKey) => {
          const rowSeats = rows[rowKey]
          const positions = [null, null, 'aisle', null, null]
          rowSeats.forEach((s) => {
            if (s.col <= 1) positions[s.col] = s
            else if (s.col >= 3) positions[s.col === 3 ? 3 : 4] = s
          })

          return (
            <div key={rowKey} className="seat-row">
              <div className="seat-row-number">{rowKey}</div>
              {positions.map((item, idx) => {
                if (item === 'aisle') {
                  return <div key={`aisle-${rowKey}`} className="seat seat-aisle" />
                }
                if (!item) {
                  return <div key={`empty-${rowKey}-${idx}`} style={{ width: 44, height: 50 }} />
                }
                return (
                  <Seat
                    key={item.id}
                    seat={item}
                    onSelect={onSelect}
                    onRelease={onRelease}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
