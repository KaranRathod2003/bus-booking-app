import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import config from './config.js';
import { initRedis } from './services/redisService.js';
import { initSocketIO } from './socket/index.js';
import { startExpiryPolling } from './services/seatService.js';

import routesRouter from './routes/routes.js';
import busesRouter from './routes/buses.js';
import seatsRouter from './routes/seats.js';
import bookingsRouter from './routes/bookings.js';
import ticketsRouter from './routes/tickets.js';
import operatorsRouter from './routes/operators.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// REST routes
app.use('/api/routes', routesRouter);
app.use('/api/buses', busesRouter);
app.use('/api/buses', seatsRouter);
app.use('/api', bookingsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/operators', operatorsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Redis
initRedis();

// Initialize Socket.IO
const io = initSocketIO(httpServer);

// Make io accessible to routes
app.set('io', io);

// Start lock expiry polling
startExpiryPolling(io);

httpServer.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
