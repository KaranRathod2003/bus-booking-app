import { useState, useEffect } from 'react'
import { MapPin, Search } from 'lucide-react'
import api from '../utils/api'

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function getMaxDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

export default function RouteSelector({ onSearch }) {
  const [cities, setCities] = useState([])
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(getTomorrow())

  useEffect(() => {
    api.get('/api/routes/cities').then((res) => setCities(res.data))
  }, [])

  const handleSearch = () => {
    if (source && destination && date) {
      onSearch(source, destination, date)
    }
  }

  return (
    <div className="route-selector">
      <div className="form-group">
        <label><MapPin size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />From</label>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Select source</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label><MapPin size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />To</label>
        <select value={destination} onChange={(e) => setDestination(e.target.value)}>
          <option value="">Select destination</option>
          {cities.filter((c) => c !== source).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="form-group date-picker-group">
        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={getToday()}
          max={getMaxDate()}
        />
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSearch}
        disabled={!source || !destination || !date}
      >
        <Search size={16} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
        Search Buses
      </button>
    </div>
  )
}
