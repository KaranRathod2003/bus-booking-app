import crypto from 'crypto';

const SECRET = 'bus-booking-poc-secret';

export function generateChecksum(pnr, seatId, busId) {
  return crypto
    .createHash('sha256')
    .update(`${pnr}${seatId}${busId}${SECRET}`)
    .digest('hex')
    .slice(0, 8);
}

export function buildQRPayload(booking, bus, route, operator) {
  return {
    pnr: booking.pnr,
    operator: operator.name,
    bus: bus.name,
    route: `${route.source} → ${route.destination}`,
    seat: booking.seatId,
    date: booking.date,
    departure: bus.departure,
    passenger: booking.passengerName,
    checksum: generateChecksum(booking.pnr, booking.seatId, booking.busId),
  };
}
