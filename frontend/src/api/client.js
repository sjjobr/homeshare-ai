/**
 * frontend/src/api/client.js
 * Axios instance pre-configured for the HomeShare AI backend.
 * Automatically attaches the JWT token from Zustand store.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// -----------------------------------------------------------------------
// Request interceptor: attach JWT token from localStorage (Zustand persist)
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
// Response interceptor: handle 401 (logout) and normalise errors
// -----------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear persisted auth state
      localStorage.removeItem('homeshare-storage');
      // Redirect to login without React Router (avoids circular deps)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
