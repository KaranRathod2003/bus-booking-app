import { io } from 'socket.io-client';

// Shared userId across all tabs via localStorage (anti-hoarding)
let userId = localStorage.getItem('busbook_userId');
if (!userId) {
  userId = 'user_' + Math.random().toString(36).slice(2, 10);
  localStorage.setItem('busbook_userId', userId);
}

// Determine API URL based on environment
const API_URL = import.meta.env.PROD
  ? 'https://bus-booking-app-rtg9.onrender.com'
  : 'http://localhost:3001';

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
});

// Connection status tracking
let connected = false;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((cb) => cb(connected));
}

socket.on('connect', () => {
  console.log('Socket connected:', socket.id, '| userId:', userId);
  connected = true;
  notifyListeners();
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  connected = false;
  notifyListeners();
});

export function onConnectionChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isConnected() {
  return connected;
}

export { socket, userId };
