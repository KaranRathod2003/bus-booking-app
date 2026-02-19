const items = [
  { swatchClass: 'legend-swatch-available', label: 'Available' },
  { swatchClass: 'legend-swatch-mine', label: 'My Selection' },
  { swatchClass: 'legend-swatch-held', label: 'Being Viewed' },
  { swatchClass: 'legend-swatch-locked', label: 'Locked (Payment)' },
  { swatchClass: 'legend-swatch-booked', label: 'Booked' },
]

export default function SeatLegend() {
  return (
    <div className="seat-legend">
      {items.map((item) => (
        <div key={item.label} className="legend-item">
          <div className={`legend-swatch ${item.swatchClass}`} />
          {item.label}
        </div>
      ))}
    </div>
  )
}
