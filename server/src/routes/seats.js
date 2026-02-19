import { Router } from 'express';
import { getSeatsWithState } from '../services/seatService.js';
import { hardLockSeat, releaseHardLock, cleanupUserTrackingKey } from '../services/redisService.js';
import { readJSON } from '../services/fileStore.js';
import config from '../config.js';

const router = Router();

// GET /api/buses/:busId/seats?userId=X&date=YYYY-MM-DD
router.get('/:busId/seats', async (req, res) => {
  try {
    const { busId } = req.params;
    const { userId, date } = req.query;
    const effectiveDate = date || new Date().toISOString().slice(0, 10);

    const seats = await getSeatsWithState(busId, userId || '', effectiveDate);
    if (!seats) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    res.json(seats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buses/:busId/seats/lock — acquire hard lock for payment
router.post('/:busId/seats/lock', async (req, res) => {
  try {
    const { busId } = req.params;
    const { seatId, userId, date } = req.body;
    const effectiveDate = date || new Date().toISOString().slice(0, 10);

    if (!seatId || !userId) {
      return res.status(400).json({ error: 'seatId and userId are required' });
    }

    // Validate bus and seat exist
    const buses = await readJSON('buses.json');
    const bus = buses.find((b) => b.id === busId);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    const seatExists = bus.seats.some((s) => s.id === seatId);
    if (!seatExists) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    const { success, releasedKey } = await hardLockSeat(busId, effectiveDate, seatId, userId);

    if (!success) {
      return res.status(409).json({ error: 'Seat is locked by another user for payment' });
    }

    // Broadcast the hard lock to the room
    const io = req.app.get('io');
    io.to(`bus:${busId}:${effectiveDate}`).emit('seat:updated', {
      busId,
      seatId,
      date: effectiveDate,
      status: 'locked',
      lockedBy: userId,
      lockType: 'lock',
      ttl: config.lock.ttl,
    });

    // If Lua released an old hard lock on a different seat, broadcast that as available
    if (releasedKey) {
      const parts = releasedKey.split(':');
      if (parts.length >= 4) {
        const relBusId = parts[1];
        const relDate = parts[2];
        const relSeatId = parts.slice(3).join(':');
        io.to(`bus:${relBusId}:${relDate}`).emit('seat:updated', {
          busId: relBusId,
          seatId: relSeatId,
          date: relDate,
          status: 'available',
          lockedBy: null,
          lockType: null,
          ttl: null,
        });
      }
    }

    res.json({ success: true, ttl: config.lock.ttl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buses/:busId/seats/unlock — explicitly release a hard lock
router.post('/:busId/seats/unlock', async (req, res) => {
  try {
    const { busId } = req.params;
    const { seatId, userId, date } = req.body;
    const effectiveDate = date || new Date().toISOString().slice(0, 10);

    if (!seatId || !userId) {
      return res.status(400).json({ error: 'seatId and userId are required' });
    }

    const released = await releaseHardLock(busId, effectiveDate, seatId, userId);

    if (!released) {
      return res.status(403).json({ error: 'You do not hold a lock on this seat' });
    }

    await cleanupUserTrackingKey(userId, 'lock');

    // Broadcast the seat as available
    const io = req.app.get('io');
    io.to(`bus:${busId}:${effectiveDate}`).emit('seat:updated', {
      busId,
      seatId,
      date: effectiveDate,
      status: 'available',
      lockedBy: null,
      lockType: null,
      ttl: null,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
