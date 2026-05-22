/**
 * frontend/src/api/client.js
 * Axios instance pre-configured for the HomeShare AI backend.
 * In dev, Vite proxies /api → http://localhost:4000 (see vite.config.js).
 * In production, set VITE_API_URL in your .env.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// -----------------------------------------------------------------------
// Request interceptor: attach JWT token from Zustand persisted store
// -----------------------------------------------------------------------
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('homeshare-storage');
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
  } catch (e) {
    // ignore parse errors
  }
  return config;
});

// -----------------------------------------------------------------------
// Response interceptor: handle 401 unauthorised → redirect to login
// -----------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('homeshare-storage');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
