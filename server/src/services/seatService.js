import { readJSON } from './fileStore.js';
import { getLockedSeats, getAllSeatLocks } from './redisService.js';
import config from '../config.js';

// Track known locks per bus:date for expiry detection
const knownLocks = new Map();

export async function getSeatsWithState(busId, requestingUserId, date) {
  const buses = await readJSON('buses.json');
  const bus = buses.find((b) => b.id === busId);
  if (!bus) return null;

  const bookings = await readJSON('bookings.json');
  const busBookings = bookings.filter(
    (b) => b.busId === busId && b.date === date && b.status === 'confirmed'
  );
  const bookedSeatIds = new Set(busBookings.map((b) => b.seatId));

  const locks = await getLockedSeats(busId, date);

  return bus.seats.map((seat) => {
    if (bookedSeatIds.has(seat.id)) {
      return { ...seat, status: 'booked', lockedBy: null, ttl: null, lockType: null };
    }

    const lock = locks[seat.id];
    if (lock) {
      const isMine = lock.userId === requestingUserId;
      let status;
      if (isMine) {
        status = 'mine';
      } else if (lock.type === 'lock') {
        status = 'locked';
      } else {
        status = 'held';
      }
      return {
        ...seat,
        status,
        lockedBy: lock.userId,
        ttl: lock.ttl,
        lockType: lock.type,
      };
    }

    return { ...seat, status: 'available', lockedBy: null, ttl: null, lockType: null };
  });
}

export function startExpiryPolling(io) {
  setInterval(async () => {
    const currentLocksByBusDate = await getAllSeatLocks();

    // Check all previously known groups for disappeared locks
    for (const [groupKey, previousSeats] of knownLocks.entries()) {
      const currentSeats = currentLocksByBusDate[groupKey] || {};

      for (const [seatId, prevInfo] of Object.entries(previousSeats)) {
        if (!currentSeats[seatId]) {
          // Lock disappeared — check if it was booked (not expired)
          const [busId, date] = groupKey.split(':');
          const bookings = await readJSON('bookings.json');
          const isBooked = bookings.some(
            (b) => b.busId === busId && b.seatId === seatId && b.date === date && b.status === 'confirmed'
          );
          if (!isBooked) {
            io.to(`bus:${busId}:${date}`).emit('seat:expired', {
              busId,
              seatId,
              date,
              expiredType: prevInfo.type || 'hold',
            });
          }
        }
      }
    }

    // Also check current groups that are new
    for (const [groupKey, currentSeats] of Object.entries(currentLocksByBusDate)) {
      const previousSeats = knownLocks.get(groupKey) || {};
      for (const [seatId, prevInfo] of Object.entries(previousSeats)) {
        if (!currentSeats[seatId]) {
          const [busId, date] = groupKey.split(':');
          const bookings = await readJSON('bookings.json');
          const isBooked = bookings.some(
            (b) => b.busId === busId && b.seatId === seatId && b.date === date && b.status === 'confirmed'
          );
          if (!isBooked) {
            io.to(`bus:${busId}:${date}`).emit('seat:expired', {
              busId,
              seatId,
              date,
              expiredType: prevInfo.type || 'hold',
            });
          }
        }
      }
    }

    // Update known locks — merge current into a new Map
    knownLocks.clear();
    for (const [groupKey, seats] of Object.entries(currentLocksByBusDate)) {
      knownLocks.set(groupKey, { ...seats });
    }
  }, config.lock.pollInterval);
}
