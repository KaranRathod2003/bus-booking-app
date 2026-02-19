import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Bus, ClipboardList } from 'lucide-react'
import { userId } from './socket'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import ToastContainer from './components/ToastContainer'
import ThemeToggle from './components/ThemeToggle'
import LiveBadge from './components/LiveBadge'
import HomePage from './pages/HomePage'
import BusListPage from './pages/BusListPage'
import SeatMapPage from './pages/SeatMapPage'
import PaymentPage from './pages/PaymentPage'
import TicketPage from './pages/TicketPage'
import ManageBookingPage from './pages/ManageBookingPage'
import UserBadge from './components/UserBadge'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/buses/:routeId" element={<BusListPage />} />
        <Route path="/seats/:busId" element={<SeatMapPage />} />
        <Route path="/payment/:busId/:seatId" element={<PaymentPage />} />
        <Route path="/ticket/:pnr" element={<TicketPage />} />
        <Route path="/manage" element={<ManageBookingPage />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="app-shell">
            <div className="app-container">
              <header className="app-header">
                <Link to="/" className="app-logo-link">
                  <Bus size={20} strokeWidth={2.5} />
                  <h1>BusBook</h1>
                </Link>
                <div className="header-right">
                  <Link to="/manage" className="header-icon-link" title="Manage Booking">
                    <ClipboardList size={18} />
                  </Link>
                  <ThemeToggle />
                  <LiveBadge />
                  <UserBadge userId={userId} />
                </div>
              </header>
              <main className="app-content">
                <AnimatedRoutes />
              </main>
            </div>
          </div>
        </BrowserRouter>
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  )
}
