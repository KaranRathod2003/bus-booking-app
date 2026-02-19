import Redis from 'ioredis';
import config from '../config.js';

let redis;

export function initRedis() {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('connect', () => console.log('Redis connected'));
  redis.on('error', (err) => console.error('Redis error:', err.message));

  return redis;
}

export function getRedis() {
  return redis;
}

// Key format: seat:{busId}:{date}:{seatId}
function seatKey(busId, date, seatId) {
  return `seat:${busId}:${date}:${seatId}`;
}

// Parse Redis seat value: "hold:userId" or "lock:userId" or legacy bare "userId"
export function parseSeatValue(value) {
  if (!value) return null;
  if (value.startsWith('hold:')) {
    return { type: 'hold', userId: value.slice(5) };
  }
  if (value.startsWith('lock:')) {
    return { type: 'lock', userId: value.slice(5) };
  }
  // Legacy bare userId fallback
  return { type: 'lock', userId: value };
}

// Lua: Soft hold a seat (stealable, short TTL)
// KEYS[1] = seat key, KEYS[2] = user:hold:{userId}, KEYS[3] = user:lock:{userId}
// ARGV[1] = userId, ARGV[2] = holdTTL
const SOFT_HOLD_SCRIPT = `
  local seatVal = redis.call("GET", KEYS[1])
  if seatVal then
    if string.sub(seatVal, 1, 5) == "lock:" then
      local lockedBy = string.sub(seatVal, 6)
      if lockedBy == ARGV[1] then
        return {"1", "", ""}
      else
        return {"0", "", ""}
      end
    end
  end
  local oldHoldSeat = redis.call("GET", KEYS[2])
  local releasedHoldKey = ""
  if oldHoldSeat and oldHoldSeat ~= KEYS[1] then
    redis.call("DEL", oldHoldSeat)
    releasedHoldKey = oldHoldSeat
  end
  local oldLockSeat = redis.call("GET", KEYS[3])
  local releasedLockKey = ""
  if oldLockSeat and oldLockSeat ~= KEYS[1] then
    redis.call("DEL", oldLockSeat)
    redis.call("DEL", KEYS[3])
    releasedLockKey = oldLockSeat
  end
  redis.call("SET", KEYS[1], "hold:" .. ARGV[1], "EX", ARGV[2])
  redis.call("SET", KEYS[2], KEYS[1], "EX", ARGV[2])
  return {"1", releasedHoldKey, releasedLockKey}
`;

// Lua: Hard lock a seat (blocking, long TTL)
// KEYS[1] = seat key, KEYS[2] = user:lock:{userId}, KEYS[3] = user:hold:{userId}
// ARGV[1] = userId, ARGV[2] = lockTTL
const HARD_LOCK_SCRIPT = `
  local seatVal = redis.call("GET", KEYS[1])
  if seatVal then
    if string.sub(seatVal, 1, 5) == "lock:" then
      local lockedBy = string.sub(seatVal, 6)
      if lockedBy == ARGV[1] then
        redis.call("EXPIRE", KEYS[1], ARGV[2])
        redis.call("SET", KEYS[2], KEYS[1], "EX", ARGV[2])
        return {"1", ""}
      else
        return {"0", ""}
      end
    end
  end
  local oldLockSeat = redis.call("GET", KEYS[2])
  local releasedKey = ""
  if oldLockSeat and oldLockSeat ~= KEYS[1] then
    redis.call("DEL", oldLockSeat)
    releasedKey = oldLockSeat
  end
  redis.call("DEL", KEYS[3])
  redis.call("SET", KEYS[1], "lock:" .. ARGV[1], "EX", ARGV[2])
  redis.call("SET", KEYS[2], KEYS[1], "EX", ARGV[2])
  return {"1", releasedKey}
`;

// Lua: Release a soft hold
// KEYS[1] = seat key, KEYS[2] = user:hold:{userId}
// ARGV[1] = userId
const RELEASE_HOLD_SCRIPT = `
  local seatVal = redis.call("GET", KEYS[1])
  if seatVal == "hold:" .. ARGV[1] then
    redis.call("DEL", KEYS[1])
    redis.call("DEL", KEYS[2])
    return 1
  end
  return 0
`;

// Lua: Release a hard lock
// KEYS[1] = seat key, KEYS[2] = user:lock:{userId}
// ARGV[1] = userId
const RELEASE_LOCK_SCRIPT = `
  local seatVal = redis.call("GET", KEYS[1])
  if seatVal == "lock:" .. ARGV[1] then
    redis.call("DEL", KEYS[1])
    redis.call("DEL", KEYS[2])
    return 1
  end
  return 0
`;

export async function holdSeat(busId, date, seatId, userId) {
  const key = seatKey(busId, date, seatId);
  const userHoldKey = `user:hold:${userId}`;
  const userLockKey = `user:lock:${userId}`;
  const result = await redis.eval(SOFT_HOLD_SCRIPT, 3, key, userHoldKey, userLockKey, userId, config.hold.ttl);
  return {
    success: result[0] === '1',
    releasedKey: result[1] || null,
    releasedLockKey: result[2] || null,
  };
}

export async function hardLockSeat(busId, date, seatId, userId) {
  const key = seatKey(busId, date, seatId);
  const userLockKey = `user:lock:${userId}`;
  const userHoldKey = `user:hold:${userId}`;
  const result = await redis.eval(HARD_LOCK_SCRIPT, 3, key, userLockKey, userHoldKey, userId, config.lock.ttl);
  return {
    success: result[0] === '1',
    releasedKey: result[1] || null,
  };
}

export async function releaseHold(busId, date, seatId, userId) {
  const key = seatKey(busId, date, seatId);
  const userHoldKey = `user:hold:${userId}`;
  const result = await redis.eval(RELEASE_HOLD_SCRIPT, 2, key, userHoldKey, userId);
  return result === 1;
}

export async function releaseHardLock(busId, date, seatId, userId) {
  const key = seatKey(busId, date, seatId);
  const userLockKey = `user:lock:${userId}`;
  const result = await redis.eval(RELEASE_LOCK_SCRIPT, 2, key, userLockKey, userId);
  return result === 1;
}

export async function cleanupUserTrackingKey(userId, type) {
  const key = type === 'hold' ? `user:hold:${userId}` : `user:lock:${userId}`;
  await redis.del(key);
}

export async function forceReleaseSeat(busId, date, seatId) {
  const key = seatKey(busId, date, seatId);
  await redis.del(key);
}

export async function getSeatLock(busId, date, seatId) {
  const key = seatKey(busId, date, seatId);
  const [value, ttl] = await Promise.all([
    redis.get(key),
    redis.ttl(key),
  ]);
  if (!value) return null;
  const parsed = parseSeatValue(value);
  return { ...parsed, ttl };
}

export async function getLockedSeats(busId, date) {
  const pattern = `seat:${busId}:${date}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return {};

  const prefix = `seat:${busId}:${date}:`;
  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.get(key);
    pipeline.ttl(key);
  }
  const results = await pipeline.exec();

  const locks = {};
  for (let i = 0; i < keys.length; i++) {
    const seatId = keys[i].replace(prefix, '');
    const value = results[i * 2][1];
    const ttl = results[i * 2 + 1][1];
    if (value) {
      const parsed = parseSeatValue(value);
      locks[seatId] = { ...parsed, ttl };
    }
  }
  return locks;
}

// Scan all seat locks in Redis — used by expiry polling
export async function getAllSeatLocks() {
  const keys = await redis.keys('seat:*');
  if (keys.length === 0) return {};

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.get(key);
  }
  const results = await pipeline.exec();

  // Group by busId:date → { seatId: { userId, type } }
  const locksByBusDate = {};
  for (let i = 0; i < keys.length; i++) {
    const value = results[i][1];
    if (!value) continue;
    const parsed = parseSeatValue(value);
    // Parse key: seat:{busId}:{date}:{seatId}
    const parts = keys[i].split(':');
    if (parts.length < 4) continue;
    const busId = parts[1];
    const date = parts[2];
    const seatId = parts.slice(3).join(':');
    const groupKey = `${busId}:${date}`;
    if (!locksByBusDate[groupKey]) locksByBusDate[groupKey] = {};
    locksByBusDate[groupKey][seatId] = { userId: parsed.userId, type: parsed.type };
  }
  return locksByBusDate;
}
