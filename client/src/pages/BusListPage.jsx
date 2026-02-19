import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../utils/api'
import BusCard from '../components/BusCard'
import PageTransition, { staggerContainer, staggerItem } from '../components/PageTransition'

export default function BusListPage() {
  const { routeId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const [buses, setBuses] = useState([])
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [busRes, routeRes] = await Promise.all([
          api.get(`/api/buses?routeId=${routeId}`),
          api.get(`/api/routes`),
        ])
        setBuses(busRes.data)
        const r = routeRes.data.find((rt) => rt.id === routeId)
        setRoute(r)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [routeId])

  if (loading) return <div className="loading">Loading buses...</div>

  return (
    <PageTransition>
      {route && (
        <>
          <h2 className="page-title">{route.source} → {route.destination}</h2>
          <p className="page-subtitle">{route.distance} km &middot; {route.duration} &middot; {date}</p>
        </>
      )}

      {buses.length === 0 ? (
        <div className="message message-info">No buses available for this route.</div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          {buses.map((bus) => (
            <motion.div key={bus.id} variants={staggerItem}>
              <BusCard
                bus={bus}
                onClick={() => navigate(`/seats/${bus.id}?date=${date}`)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  )
}
