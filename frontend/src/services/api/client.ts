import axios from 'axios';
import * as SecureStore from '../storage/secureStorage';
import { constants } from '@/constants';

// API base URL. Set EXPO_PUBLIC_API_URL in frontend/.env to your laptop's LAN IP
// when testing on a physical phone, e.g. http://192.168.1.23:5000/api
// (a phone cannot reach "localhost"). Web/emulator can use http://localhost:5000/api.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.82:5000/api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach JWT token for Node.js 'protect' middleware
client.interceptors.request.use(
  async (config: any) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Auth token fetch failed', error);
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

/**
 * Main API caller for Accelerometer and Tapping tasks
 */
export async function submitSession<T>(path: string, payload: T) {
  try {
    const response = await client.post(path, payload);
    return { 
      ok: true, 
      data: response.data 
    };
  } catch (error: any) {
    console.error(`API Error: ${error.response?.data?.message || error.message}`);
    return { ok: false, error: error.response?.data };
  }
}

export default client;