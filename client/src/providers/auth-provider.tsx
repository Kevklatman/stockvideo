// src/providers/auth-provider.tsx
'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { authApi, ValidationException } from '@/lib/api-client';

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
    const initializeAuth = async () => {
      console.log('Initializing auth state...');
      setIsLoading(true);
      
      try {
        const token = localStorage.getItem('auth_token');
        console.log('Stored token:', token ? 'exists' : 'none');
        
        if (token) {
          authApi.setAuthToken(token);
          const userData = await authApi.validateToken();
          console.log('User data from token:', userData);
          if (userData) {
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('auth_token');
        authApi.setAuthToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    console.log('Login attempt...');
    setIsLoading(true);
    
    try {
      const response = await authApi.login(email, password);
      console.log('Login response:', response);
      
      if (response?.token) {
        localStorage.setItem('auth_token', response.token);
        authApi.setAuthToken(response.token);
      }
      
      if (response?.user) {
        console.log('Setting user state:', response.user);
        setUser(response.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof ValidationException) {
        const passwordErrors = error.errors
          .filter(err => err.field === 'password')
          .map(err => err.message);
          
        if (passwordErrors.length > 0) {
          throw new Error(passwordErrors.join('. '));
        }
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await authApi.register(email, password);
      console.log('Register response:', response);
      
      if (response?.token) {
        localStorage.setItem('auth_token', response.token);
        authApi.setAuthToken(response.token);
      }
      
      if (response?.user) {
        setUser(response.user);
      }
    } catch (error) {
      if (error instanceof ValidationException) {
        const passwordErrors = error.errors
          .filter(err => err.field === 'password')
          .map(err => err.message);
          
        if (passwordErrors.length > 0) {
          throw new Error(passwordErrors.join('. '));
        }
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('Logout...');
    localStorage.removeItem('auth_token');
    authApi.setAuthToken(null);
    setUser(null);
  };

  console.log('Auth Provider state:', { user, isLoading });

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