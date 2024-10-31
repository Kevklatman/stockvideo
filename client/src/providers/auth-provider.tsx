// src/providers/auth-provider.tsx
'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { authApi, ValidationException } from '../lib/api-client';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Debug state changes
  useEffect(() => {
    console.log('Auth state changed:', { user, isLoading, isInitialized });
  }, [user, isLoading, isInitialized]);

  // Initialize authentication
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('Initializing auth state...');
      setIsLoading(true);
      
      try {
        const token = localStorage.getItem('auth_token');
        console.log('Stored token:', token ? 'exists' : 'none');
        
        if (token) {
          authApi.setAuthToken(token);
          const response = await authApi.validateToken();
          console.log('Token validation response:', response);
          
          if (response.status === 'success' && response.data.user) {
            await new Promise<void>(resolve => {
              setUser(response.data.user);
              setTimeout(resolve, 0);
            });
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('auth_token');
        authApi.setAuthToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    console.log('Login attempt for:', email);
    setIsLoading(true);
    
    try {
      const response = await authApi.login(email, password);
      console.log('Raw login response:', response);

      if (!response || response.status !== 'success' || !response.data) {
        throw new Error('Invalid response format');
      }

      const { token, user: userData } = response.data;

      if (!token || !userData) {
        throw new Error('Missing token or user data');
      }

      // Store token
      localStorage.setItem('auth_token', token);
      authApi.setAuthToken(token);

      // Update user state with waiting
      await new Promise<void>(resolve => {
        setUser(userData);
        setTimeout(() => {
          console.log('User state updated:', userData);
          resolve();
        }, 0);
      });

    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('auth_token');
      authApi.setAuthToken(null);
      setUser(null);

      if (error instanceof ValidationException) {
        const passwordErrors = error.errors
          ?.filter(err => err.field === 'password')
          ?.map(err => err.message) || [];
          
        if (passwordErrors.length > 0) {
          throw new Error(passwordErrors.join('. '));
        }
      }

      throw error instanceof Error ? error : new Error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await authApi.register(email, password);
      console.log('Register response:', response);

      if (!response || response.status !== 'success' || !response.data) {
        throw new Error('Invalid response format');
      }

      const { token, user: userData } = response.data;

      if (!token || !userData) {
        throw new Error('Missing token or user data');
      }

      localStorage.setItem('auth_token', token);
      authApi.setAuthToken(token);

      await new Promise<void>(resolve => {
        setUser(userData);
        setTimeout(() => {
          console.log('User state updated after registration:', userData);
          resolve();
        }, 0);
      });

    } catch (error) {
      localStorage.removeItem('auth_token');
      authApi.setAuthToken(null);
      setUser(null);

      if (error instanceof ValidationException) {
        const passwordErrors = error.errors
          ?.filter(err => err.field === 'password')
          ?.map(err => err.message) || [];
          
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
    console.log('Logging out...');
    localStorage.removeItem('auth_token');
    authApi.setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      isInitialized,
      login, 
      logout, 
      register 
    }}>
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