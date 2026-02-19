import { Snowflake, BedDouble, Armchair, Bus, Star } from 'lucide-react'

function getAmenityIcons(busType) {
  const type = (busType || '').toLowerCase()
  const icons = []
  if (type.includes('ac')) icons.push({ icon: <Snowflake size={14} />, label: 'AC' })
  if (type.includes('sleeper')) icons.push({ icon: <BedDouble size={14} />, label: 'Sleeper' })
  if (type.includes('seater') || type.includes('semi')) icons.push({ icon: <Armchair size={14} />, label: 'Seater' })
  if (icons.length === 0) icons.push({ icon: <Bus size={14} />, label: busType || 'Standard' })
  return icons
}

export default function BusCard({ bus, onClick }) {
  const amenities = getAmenityIcons(bus.type)
  const rating = Math.floor(bus.operator?.rating || 0)

  return (
    <div className="bus-card" onClick={onClick}>
      <div className="bus-card-left">
        <div className="operator-logo">
          {bus.operator?.logo || '?'}
        </div>
        <div className="bus-info">
          <h3>{bus.name}</h3>
          <p>{bus.type} &middot; {bus.operator?.name}</p>
          <div className="bus-amenities">
            {amenities.map((a, i) => (
              <span key={i} className="bus-amenity" title={a.label}>{a.icon} {a.label}</span>
            ))}
          </div>
          <div className="bus-timeline">
            <span>{bus.departure}</span>
            <div className="bus-timeline-dot" />
            <div className="bus-timeline-line" />
            <div className="bus-timeline-dot" />
            <span>{bus.arrival}</span>
          </div>
        </div>
      </div>
      <div className="bus-card-right">
        <div className="bus-price">₹{bus.price}</div>
        <span className="operator-rating">
          {Array.from({ length: rating }, (_, i) => (
            <Star key={i} size={12} fill="currentColor" strokeWidth={0} />
          ))}
          {' '}{bus.operator?.rating}
        </span>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{bus.totalSeats} seats</div>
      </div>
    </div>
  )
}
