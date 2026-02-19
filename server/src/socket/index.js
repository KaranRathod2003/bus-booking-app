import { Server } from 'socket.io';
import { getSeatsWithState } from '../services/seatService.js';
import { registerSeatHandlers } from './seatHandler.js';
import { releaseHold, getRedis, parseSeatValue } from '../services/redisService.js';
import config from '../config.js';

function broadcastViewerCount(io, busId, date) {
  const roomName = `bus:${busId}:${date}`;
  const room = io.sockets.adapter.rooms.get(roomName);
  const count = room ? room.size : 0;
  io.to(roomName).emit('bus:viewers', { busId, date, count });
}

export function initSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // bus:join - join a bus+date room to receive seat updates
    socket.on('bus:join', async ({ busId, userId, date }) => {
      const effectiveDate = date || new Date().toISOString().slice(0, 10);
      const roomName = `bus:${busId}:${effectiveDate}`;
      socket.join(roomName);
      socket.data.busId = busId;
      socket.data.date = effectiveDate;
      socket.data.userId = userId;

      // Send full seat snapshot for this bus+date
      const seats = await getSeatsWithState(busId, userId || '', effectiveDate);
      socket.emit('seats:snapshot', { busId, date: effectiveDate, seats });

      // Broadcast updated viewer count
      broadcastViewerCount(io, busId, effectiveDate);
    });

    // bus:leave - leave a bus+date room
    socket.on('bus:leave', ({ busId, date }) => {
      const effectiveDate = date || socket.data.date || new Date().toISOString().slice(0, 10);
      const roomName = `bus:${busId}:${effectiveDate}`;
      socket.leave(roomName);
      broadcastViewerCount(io, busId, effectiveDate);
    });

    registerSeatHandlers(io, socket);

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Broadcast viewer count for the bus+date room this socket was in
      if (socket.data.busId && socket.data.date) {
        broadcastViewerCount(io, socket.data.busId, socket.data.date);
      }

      // Release any active soft hold for this user (do NOT release hard locks)
      const userId = socket.data.userId;
      if (userId) {
        try {
          const redis = getRedis();
          const userHoldKey = `user:hold:${userId}`;
          const heldSeatKey = await redis.get(userHoldKey);
          if (heldSeatKey) {
            // Parse seat key: seat:{busId}:{date}:{seatId}
            const parts = heldSeatKey.split(':');
            if (parts.length >= 4) {
              const busId = parts[1];
              const date = parts[2];
              const seatId = parts.slice(3).join(':');
              const released = await releaseHold(busId, date, seatId, userId);
              if (released) {
                io.to(`bus:${busId}:${date}`).emit('seat:updated', {
                  busId,
                  seatId,
                  date,
                  status: 'available',
                  lockedBy: null,
                  lockType: null,
                  ttl: null,
                });
              }
            }
          }
        } catch (err) {
          console.error('Error releasing hold on disconnect:', err.message);
        }
      }
    });
  });

  return io;
}
