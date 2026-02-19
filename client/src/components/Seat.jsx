import { useRef, useState, useEffect } from 'react'

export default function Seat({ seat, onSelect, onRelease }) {
  const prevStatusRef = useRef(seat.status)
  const [flashClass, setFlashClass] = useState('')

  useEffect(() => {
    const prev = prevStatusRef.current
    const curr = seat.status

    if (prev !== curr) {
      // available/mine → locked/held (other user grabbed it)
      if ((prev === 'available' || prev === 'mine') && (curr === 'locked' || curr === 'other' || curr === 'held')) {
        setFlashClass('seat-flash-locked')
      }
      // locked/held → available (expired/released)
      else if ((prev === 'locked' || prev === 'other' || prev === 'held') && curr === 'available') {
        setFlashClass('seat-flash-available')
      }
      prevStatusRef.current = curr
    }
  }, [seat.status])

  const handleAnimationEnd = () => {
    setFlashClass('')
  }

  const getClassName = () => {
    const base = (() => {
      switch (seat.status) {
        case 'booked': return 'seat seat-booked'
        case 'mine': return 'seat seat-mine'
        case 'locked': return 'seat seat-other'
        case 'held': return 'seat seat-held'
        case 'available': return 'seat seat-available'
        default: return 'seat seat-available'
      }
    })()
    return flashClass ? `${base} ${flashClass}` : base
  }

  const handleClick = () => {
    if (seat.status === 'booked' || seat.status === 'locked') return
    if (seat.status === 'mine') {
      onRelease(seat.id)
    } else {
      // available and held are both clickable (held = steal soft hold)
      onSelect(seat.id)
    }
  }

  const getTitle = () => {
    switch (seat.status) {
      case 'held': return `Seat ${seat.id} - Being Viewed`
      case 'locked': return `Seat ${seat.id} - Locked for Payment`
      default: return `Seat ${seat.id} - ${seat.status}`
    }
  }

  return (
    <div
      className={getClassName()}
      onClick={handleClick}
      onAnimationEnd={handleAnimationEnd}
      title={getTitle()}
    >
      {seat.id}
    </div>
  )
}
