import { holdSeat, releaseHold, releaseHardLock, getSeatLock } from '../services/redisService.js';
import { bookSeat } from '../services/bookingService.js';

// Parse a released seat key like "seat:busA:2025-01-01:3A" into components
function parseReleasedKey(key) {
  if (!key) return null;
  const parts = key.split(':');
  if (parts.length < 4) return null;
  return { busId: parts[1], date: parts[2], seatId: parts.slice(3).join(':') };
}

export function registerSeatHandlers(io, socket) {
  // seat:select - request a soft hold on a seat
  socket.on('seat:select', async ({ busId, seatId, userId, date }) => {
    const effectiveDate = date || socket.data.date || new Date().toISOString().slice(0, 10);
    try {
      const { success, releasedKey, releasedLockKey } = await holdSeat(busId, effectiveDate, seatId, userId);
      if (success) {
        const lock = await getSeatLock(busId, effectiveDate, seatId);
        io.to(`bus:${busId}:${effectiveDate}`).emit('seat:updated', {
          busId,
          seatId,
          date: effectiveDate,
          status: lock && lock.type === 'lock' ? 'locked' : 'held',
          lockedBy: userId,
          lockType: lock ? lock.type : 'hold',
          ttl: lock ? lock.ttl : 30,
        });
        socket.emit('seat:select:result', { success: true, busId, seatId, date: effectiveDate });

        // If Lua auto-released an old hold on a different seat, broadcast it as available
        const released = parseReleasedKey(releasedKey);
        if (released) {
          io.to(`bus:${released.busId}:${released.date}`).emit('seat:updated', {
            busId: released.busId,
            seatId: released.seatId,
            date: released.date,
            status: 'available',
            lockedBy: null,
            lockType: null,
            ttl: null,
          });
        }

        // If Lua auto-released an old hard lock on a different seat, broadcast it as available
        const releasedLock = parseReleasedKey(releasedLockKey);
        if (releasedLock) {
          io.to(`bus:${releasedLock.busId}:${releasedLock.date}`).emit('seat:updated', {
            busId: releasedLock.busId,
            seatId: releasedLock.seatId,
            date: releasedLock.date,
            status: 'available',
            lockedBy: null,
            lockType: null,
            ttl: null,
          });
        }
      } else {
        socket.emit('seat:select:result', {
          success: false,
          busId,
          seatId,
          date: effectiveDate,
          error: 'Seat is locked for payment by another user',
        });
      }
    } catch (err) {
      socket.emit('seat:select:result', {
        success: false,
        busId,
        seatId,
        date: effectiveDate,
        error: err.message,
      });
    }
  });

  // seat:release - release a soft hold or hard lock
  socket.on('seat:release', async ({ busId, seatId, userId, date }) => {
    const effectiveDate = date || socket.data.date || new Date().toISOString().slice(0, 10);
    try {
      let released = await releaseHold(busId, effectiveDate, seatId, userId);
      if (!released) {
        released = await releaseHardLock(busId, effectiveDate, seatId, userId);
      }
      if (released) {
        io.to(`bus:${busId}:${effectiveDate}`).emit('seat:updated', {
          busId,
          seatId,
          date: effectiveDate,
          status: 'available',
          lockedBy: null,
          lockType: null,
          ttl: null,
        });
      }
      socket.emit('seat:release:result', { success: released, busId, seatId, date: effectiveDate });
    } catch (err) {
      socket.emit('seat:release:result', {
        success: false,
        busId,
        seatId,
        date: effectiveDate,
        error: err.message,
      });
    }
  });

  // seat:book - confirm booking (payment complete)
  socket.on('seat:book', async ({ busId, seatId, userId, passengerName, phone, date }) => {
    const effectiveDate = date || socket.data.date || new Date().toISOString().slice(0, 10);
    try {
      const result = await bookSeat({ busId, seatId, userId, passengerName, phone, date: effectiveDate });
      io.to(`bus:${busId}:${effectiveDate}`).emit('seat:updated', {
        busId,
        seatId,
        date: effectiveDate,
        status: 'booked',
        lockedBy: null,
        lockType: null,
        ttl: null,
      });
      socket.emit('seat:book:result', {
        success: true,
        busId,
        seatId,
        date: effectiveDate,
        booking: result.booking,
        qrPayload: result.qrPayload,
      });
    } catch (err) {
      socket.emit('seat:book:result', {
        success: false,
        busId,
        seatId,
        date: effectiveDate,
        error: err.message,
      });
    }
  });
}
