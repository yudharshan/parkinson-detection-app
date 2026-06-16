import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { constants } from '@/constants';

// Replace 192.168.x.x with your actual IPv4 address
const BASE_URL = /*constants.api?.baseUrl ||*/ 'http://10.122.91.75:5000/api';

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