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
            console.log('Setting initial user state:', response.data.user);
            setUser(response.data.user);
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
      // Initial API call
      const response = await authApi.login(email, password);
      console.log('Raw login response:', response);

      // Validate response structure
      if (!response) {
        console.error('Login response is undefined');
        throw new Error('Login failed - no response');
      }

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response && response.status === 'success' && response.data) {
        // Extract token and user data
        const { token, user: userData } = response.data;
        console.log('Extracted token:', token ? 'exists' : 'missing');
        console.log('Extracted user data:', userData);
        
        if (!token) {
          console.error('No token in successful response');
          throw new Error('Login failed - no token');
        }

        if (!userData) {
          console.error('No user data in successful response');
          throw new Error('Login failed - no user data');
        }

        // Set token
        console.log('Setting auth token');
        localStorage.setItem('auth_token', token);
        authApi.setAuthToken(token);

        // Set user state
        console.log('Setting user state:', userData);
        setUser(userData);
        console.log('User state after set:', userData);
      } else {
        console.error('Invalid response format:', response);
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Login error details:', error);
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

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Login failed');
    } finally {
      setIsLoading(false);
      // Log final state
      console.log('Login attempt completed. Final state:', {
        user: user,
        isLoading: false,
        isInitialized: true
      });
    }
  };

  const register = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await authApi.register(email, password);
      console.log('Register response:', response);

      if (response && response.status === 'success' && response.data) {
        const { token, user: userData } = response.data;
        
        if (token) {
          localStorage.setItem('auth_token', token);
          authApi.setAuthToken(token);
        }

        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
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
    console.log('Logout...');
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