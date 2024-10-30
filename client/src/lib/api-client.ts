// src/lib/api-client.ts
import axios, { AxiosError } from 'axios';
import { debounce } from 'lodash';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export const authApi = {
  login: debounce(async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      
      // Set the token in the default headers for subsequent requests
      if (response.data.token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      if (axiosError.response?.status === 429) {
        const retryAfter = axiosError.response.headers['retry-after'];
        console.log('Rate limited, retry after:', retryAfter);
      }
      throw error;
    }
  }, 300),

  register: debounce(async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        email,
        password,
      });
      
      // Set the token in the default headers for subsequent requests
      if (response.data.token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      if (axiosError.response?.status === 429) {
        const retryAfter = axiosError.response.headers['retry-after'];
        console.log('Rate limited, retry after:', retryAfter);
      }
      throw error;
    }
  }, 300),

  validateToken: async (token: string): Promise<User | null> => {
    try {
      const response = await api.get<User>('/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      return null;
    }
  },

  // Utility function to set/remove the auth token
  setAuthToken: (token: string | null) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }
};

// Add response interceptor for handling token expiration
api.interceptors.response.use(
  response => response,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;