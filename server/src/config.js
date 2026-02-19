export default {
  port: process.env.PORT || 3001,
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  },
  hold: {
    ttl: 30, // 30 seconds soft hold (seat browsing)
  },
  lock: {
    ttl: 600, // 10 minutes hard lock (payment)
    pollInterval: 3000, // 3 seconds for snappier expiry detection
  },
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  },
};
