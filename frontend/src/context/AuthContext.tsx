import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from '../services/storage/secureStorage';
import axios from 'axios';
import client from '../services/api/client';

export interface UserInfo {
  userId: string;
  name: string;
  role: 'patient' | 'clinician';
  clinicianId?: string;
  patientCode?: string;
}

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (name: string, email: string, password: string, age?: number, diagnosisYear?: number, role?: 'patient' | 'clinician', doctorCode?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('userToken');
        const storedUserJson = await SecureStore.getItemAsync('userInfo');
        
        if (storedToken && storedUserJson) {
          setToken(storedToken);
          setUser(JSON.parse(storedUserJson));
        }
      } catch (e) {
        console.error('Failed to load secure store auth data', e);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await client.post('/auth/login', { email, password });
      
      if (response.data && response.data.token) {
        const { token: jwtToken, userId, name, role, clinicianId, patientCode } = response.data;
        const userInfo: UserInfo = { userId, name, role, clinicianId, patientCode };

        await SecureStore.setItemAsync('userToken', jwtToken);
        await SecureStore.setItemAsync('userInfo', JSON.stringify(userInfo));

        setToken(jwtToken);
        setUser(userInfo);
        return { success: true };
      }
      return { success: false, message: 'Invalid server response structure' };
    } catch (error: any) {
      console.error('Login request failed', error);
      const errMsg = error.response?.data?.message || error.message || 'Login failed';
      return { success: false, message: errMsg };
    }
  };

  const signup = async (name: string, email: string, password: string, age?: number, diagnosisYear?: number, role: 'patient' | 'clinician' = 'patient', doctorCode?: string) => {
    try {
      const response = await client.post('/auth/signup', {
        name,
        email,
        password,
        age,
        diagnosisYear,
        role,
        doctorCode,
      });
      if (response.status === 201) {
        return { success: true };
      }
      return { success: false, message: 'Signup failed. Please try again.' };
    } catch (error: any) {
      console.error('Signup request failed', error);
      const errMsg = error.response?.data?.message || error.message || 'Signup failed';
      return { success: false, message: errMsg };
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userInfo');
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
