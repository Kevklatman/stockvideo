// src/lib/api-client.ts
import axios from 'axios';
import { debounce } from 'lodash';

interface ValidationError {
  field: string;
  message: string;
}

interface ApiErrorResponse {
  status: 'error';
  code: string;
  message: string;
  errors?: ValidationError[];
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export class ValidationException extends Error {
  code: string;
  errors: ValidationError[];
  
  constructor(message: string, code: string, errors: ValidationError[]) {
    super(message);
    this.name = 'ValidationException';
    this.code = code;
    this.errors = errors;
  }
}

const handleApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as ApiErrorResponse;
    if (responseData) {
      throw new ValidationException(
        responseData.message,
        responseData.code,
        responseData.errors || []
      );
    }
  }
  throw error;
};

export const authApi = {
  register: debounce(async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        email,
        password,
      });
      
      if (response.data.token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }, 300),

  login: debounce(async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      
      if (response.data.token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }, 300),

  setAuthToken: (token: string | null) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }
};

export default api;