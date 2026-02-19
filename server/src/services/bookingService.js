import { readJSON, updateJSON } from './fileStore.js';
import { getSeatLock, forceReleaseSeat, cleanupUserTrackingKey } from './redisService.js';
import { generatePNR } from './pnrService.js';
import { buildQRPayload } from './qrService.js';
import { v4 as uuidv4 } from 'uuid';

export async function bookSeat({ busId, seatId, userId, passengerName, phone, date }) {
  const bookingDate = date || new Date().toISOString().slice(0, 10);

  // Verify the user holds a hard lock (required for booking)
  const lock = await getSeatLock(busId, bookingDate, seatId);
  if (!lock || lock.userId !== userId) {
    throw new Error('You do not hold a lock on this seat');
  }
  if (lock.type !== 'lock') {
    throw new Error('A hard lock is required for booking. Please proceed to payment first.');
  }

  // Check seat isn't already booked for this date
  const bookings = await readJSON('bookings.json');

  // Prevent duplicate booking by same user (double-click / network retry)
  const duplicateByUser = bookings.find(
    (b) => b.busId === busId && b.seatId === seatId && b.date === bookingDate && b.userId === userId && b.status === 'confirmed'
  );
  if (duplicateByUser) {
    const qrPayload = buildQRPayload(
      duplicateByUser,
      (await readJSON('buses.json')).find((b) => b.id === busId),
      (await readJSON('routes.json')).find((r) => r.id === duplicateByUser.routeId),
      (await readJSON('operators.json')).find((o) => o.id === duplicateByUser.operatorId)
    );
    return { booking: duplicateByUser, qrPayload };
  }

  const existing = bookings.find(
    (b) => b.busId === busId && b.seatId === seatId && b.date === bookingDate && b.status === 'confirmed'
  );
  if (existing) {
    throw new Error('Seat is already booked');
  }

  const buses = await readJSON('buses.json');
  const bus = buses.find((b) => b.id === busId);
  if (!bus) throw new Error('Bus not found');

  const routes = await readJSON('routes.json');
  const route = routes.find((r) => r.id === bus.routeId);

  const operators = await readJSON('operators.json');
  const operator = operators.find((o) => o.id === bus.operatorId);

  const pnr = generatePNR();
  const booking = {
    id: `bk_${uuidv4().slice(0, 8)}`,
    pnr,
    busId,
    operatorId: bus.operatorId,
    routeId: bus.routeId,
    seatId,
    passengerName,
    phone,
    date: bookingDate,
    price: bus.price,
    status: 'confirmed',
    bookedAt: new Date().toISOString(),
  };

  await updateJSON('bookings.json', (data) => [...data, booking]);

  // Release the Redis lock since seat is now permanently booked
  await forceReleaseSeat(busId, bookingDate, seatId);
  await cleanupUserTrackingKey(userId, 'lock');

  const qrPayload = buildQRPayload(booking, bus, route, operator);

  return { booking, qrPayload };
}

export async function cancelBooking(pnr) {
  const bookings = await readJSON('bookings.json');
  const booking = bookings.find((b) => b.pnr === pnr && b.status === 'confirmed');
  if (!booking) throw new Error('Booking not found or already cancelled');

  const buses = await readJSON('buses.json');
  const bus = buses.find((b) => b.id === booking.busId);
  if (!bus) throw new Error('Bus not found');

  // Calculate penalty based on departure time
  const departureDate = new Date(`${booking.date}T${bus.departure}:00`);
  const now = new Date();
  const hoursUntilDeparture = (departureDate - now) / (1000 * 60 * 60);

  if (hoursUntilDeparture < 0) {
    throw new Error('Cannot cancel after departure');
  }

  let penaltyPercent;
  if (hoursUntilDeparture > 24) penaltyPercent = 10;
  else if (hoursUntilDeparture > 12) penaltyPercent = 25;
  else if (hoursUntilDeparture > 6) penaltyPercent = 50;
  else penaltyPercent = 75;

  const penalty = Math.round(booking.price * (penaltyPercent / 100));
  const refund = booking.price - penalty;

  await updateJSON('bookings.json', (data) =>
    data.map((b) =>
      b.pnr === pnr
        ? { ...b, status: 'cancelled', cancelledAt: new Date().toISOString(), penalty, refund }
        : b
    )
  );

  return {
    pnr,
    busId: booking.busId,
    seatId: booking.seatId,
    date: booking.date,
    penaltyPercent,
    penalty,
    refund,
    originalPrice: booking.price,
  };
}

export async function rescheduleBooking({ pnr, newBusId, newSeatId, newDate, userId }) {
  const bookings = await readJSON('bookings.json');
  const oldBooking = bookings.find((b) => b.pnr === pnr && b.status === 'confirmed');
  if (!oldBooking) throw new Error('Booking not found or not active');

  const effectiveNewDate = newDate || oldBooking.date;

  // Verify new seat isn't booked for the target date
  const existingBooking = bookings.find(
    (b) => b.busId === newBusId && b.seatId === newSeatId && b.date === effectiveNewDate && b.status === 'confirmed'
  );
  if (existingBooking) throw new Error('New seat is already booked');

  // Verify user holds a hold or lock on the new seat
  const lock = await getSeatLock(newBusId, effectiveNewDate, newSeatId);
  if (!lock || lock.userId !== userId) {
    throw new Error('You do not hold a lock on the new seat. Please select a seat first.');
  }
  // Accept both soft hold and hard lock for reschedule

  const buses = await readJSON('buses.json');
  const newBus = buses.find((b) => b.id === newBusId);
  if (!newBus) throw new Error('New bus not found');

  const routes = await readJSON('routes.json');
  const route = routes.find((r) => r.id === newBus.routeId);

  const operators = await readJSON('operators.json');
  const operator = operators.find((o) => o.id === newBus.operatorId);

  const newPnr = generatePNR();
  const newBooking = {
    id: `bk_${uuidv4().slice(0, 8)}`,
    pnr: newPnr,
    previousPnr: pnr,
    busId: newBusId,
    operatorId: newBus.operatorId,
    routeId: newBus.routeId,
    seatId: newSeatId,
    passengerName: oldBooking.passengerName,
    phone: oldBooking.phone,
    date: effectiveNewDate,
    price: newBus.price,
    status: 'confirmed',
    bookedAt: new Date().toISOString(),
  };

  await updateJSON('bookings.json', (data) => [
    ...data.map((b) =>
      b.pnr === pnr ? { ...b, status: 'rescheduled', rescheduledTo: newPnr } : b
    ),
    newBooking,
  ]);

  // Release the lock since seat is now permanently booked
  await forceReleaseSeat(newBusId, effectiveNewDate, newSeatId);
  await cleanupUserTrackingKey(userId, lock.type);

  const qrPayload = buildQRPayload(newBooking, newBus, route, operator);

  return {
    oldPnr: pnr,
    oldBusId: oldBooking.busId,
    oldSeatId: oldBooking.seatId,
    oldDate: oldBooking.date,
    newBooking,
    qrPayload,
  };
}

export async function getTicket(pnr) {
  const bookings = await readJSON('bookings.json');
  const booking = bookings.find((b) => b.pnr === pnr);
  if (!booking) throw new Error('Booking not found');

  const buses = await readJSON('buses.json');
  const bus = buses.find((b) => b.id === booking.busId);

  const routes = await readJSON('routes.json');
  const route = routes.find((r) => r.id === bus.routeId);

  const operators = await readJSON('operators.json');
  const operator = operators.find((o) => o.id === bus.operatorId);

  const qrPayload = booking.status === 'confirmed'
    ? buildQRPayload(booking, bus, route, operator)
    : null;

  return {
    booking,
    bus: { id: bus.id, name: bus.name, type: bus.type, departure: bus.departure, arrival: bus.arrival },
    route,
    operator,
    qrPayload,
  };
}
