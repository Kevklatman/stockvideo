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


export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface ApiResponse<T> {
  status: 'success';
  data: T;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      headers: {
        ...config.headers,
        Authorization: config.headers.Authorization ? 'Bearer ...' : 'none'
      }
    });
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Response Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

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
  register: debounce(async (email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', {
        email,
        password,
      });
      
      if (response.data.data.token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }, 300),

  login: async (email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
    try {
      console.log('Sending login request to API');
      const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
        email,
        password,
      });
      
      console.log('Raw API response:', response.data);
      
      // Validate response structure
      if (!response.data?.status || !response.data?.data?.token || !response.data?.data?.user) {
        console.error('Invalid API response structure:', response.data);
        throw new Error('Invalid API response format');
      }

      // Set token for future requests
      const { token } = response.data.data;
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      return response.data;
    } catch (error) {
      console.error('API login error:', error);
      throw handleApiError(error);
    }
  },

  validateToken: async (): Promise<ApiResponse<{ user: AuthResponse['user'] }>> => {
    try {
      const response = await api.get<ApiResponse<{ user: AuthResponse['user'] }>>('/auth/validate');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  setAuthToken: (token: string | null) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }
};

export default api;