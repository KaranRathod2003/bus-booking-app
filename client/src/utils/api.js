import axios from 'axios';

// Determine API URL based on environment
// In production (Vercel), use the Render backend URL
// In development, use localhost
const API_URL = import.meta.env.PROD 
  ? 'https://bus-booking-app-rtg9.onrender.com' 
  : 'http://localhost:3001';

// Create axios instance with baseURL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
