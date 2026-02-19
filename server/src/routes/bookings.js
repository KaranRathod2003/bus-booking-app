import { Router } from 'express';
import { bookSeat, cancelBooking, rescheduleBooking } from '../services/bookingService.js';

const router = Router();

// POST /api/book
router.post('/book', async (req, res) => {
  try {
    const { busId, seatId, userId, passengerName, phone, date } = req.body;
    if (!busId || !seatId || !userId || !passengerName || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const bookingDate = date || new Date().toISOString().slice(0, 10);
    const result = await bookSeat({ busId, seatId, userId, passengerName, phone, date: bookingDate });

    // Broadcast seat booked to all users in the bus+date room
    const io = req.app.get('io');
    io.to(`bus:${busId}:${bookingDate}`).emit('seat:updated', {
      busId,
      seatId,
      date: bookingDate,
      status: 'booked',
      lockedBy: null,
      ttl: null,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cancel
router.post('/cancel', async (req, res) => {
  try {
    const { pnr } = req.body;
    if (!pnr) return res.status(400).json({ error: 'PNR is required' });
    const result = await cancelBooking(pnr);

    // Broadcast seat released to the bus+date room
    const io = req.app.get('io');
    io.to(`bus:${result.busId}:${result.date}`).emit('seat:updated', {
      busId: result.busId,
      seatId: result.seatId,
      date: result.date,
      status: 'available',
      lockedBy: null,
      ttl: null,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/reschedule
router.post('/reschedule', async (req, res) => {
  try {
    const { pnr, newBusId, newSeatId, newDate, userId } = req.body;
    if (!pnr || !newBusId || !newSeatId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await rescheduleBooking({ pnr, newBusId, newSeatId, newDate, userId });

    const io = req.app.get('io');

    // Broadcast old seat released to old bus+date room
    io.to(`bus:${result.oldBusId}:${result.oldDate}`).emit('seat:updated', {
      busId: result.oldBusId,
      seatId: result.oldSeatId,
      date: result.oldDate,
      status: 'available',
      lockedBy: null,
      ttl: null,
    });

    // Broadcast new seat booked to new bus+date room
    const newBookingDate = result.newBooking.date;
    io.to(`bus:${newBusId}:${newBookingDate}`).emit('seat:updated', {
      busId: newBusId,
      seatId: newSeatId,
      date: newBookingDate,
      status: 'booked',
      lockedBy: null,
      ttl: null,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
