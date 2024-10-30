// src/providers/auth-provider.tsx
"use client";

import { AxiosError } from 'axios';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { authApi } from '@/lib/api-client';

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.login(email, password);
      if (response && response.token) {
        localStorage.setItem('auth_token', response.token);
      }
      if (response) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.register(email, password);
      if (response && response.token) {
        localStorage.setItem('auth_token', response.token);
      }
      if (response) {
        setUser(response.user);
      }
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      console.error('Registration error:', axiosError.response?.data);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}