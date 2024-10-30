// app/lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface ApiError {
  status: 'error';
  code: string;
  message: string;
  errors?: {
    field: string;
    message: string;
  }[];
}

export class ApiException extends Error {
  code: string;
  errors?: { field: string; message: string; }[];

  constructor(message: string, code: string, errors?: { field: string; message: string; }[]) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.errors = errors;
  }
}

export interface ApiResponse<T> {
  status: 'success';
  data: T;
}

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  try {
    const token = localStorage.getItem('auth_token');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if it exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    // Check if the response is an error
    if (!response.ok) {
      const errorData = data as ApiError;
      throw new ApiException(
        errorData.message || 'API request failed',
        errorData.code || 'UNKNOWN_ERROR',
        errorData.errors
      );
    }

    // For successful responses, return the data field
    return (data as ApiResponse<T>).data;
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }

    // Handle network errors or other issues
    if (error instanceof Error) {
      throw new ApiException(
        error.message,
        'NETWORK_ERROR'
      );
    }

    throw new ApiException(
      'An unexpected error occurred',
      'UNKNOWN_ERROR'
    );
  }
}

// Helper methods for common HTTP methods
export const api = {
  get: <T>(endpoint: string, options: Omit<FetchOptions, 'body' | 'method'> = {}) => 
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options: Omit<FetchOptions, 'body' | 'method'> = {}) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options: Omit<FetchOptions, 'body' | 'method'> = {}) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options: Omit<FetchOptions, 'body' | 'method'> = {}) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options: Omit<FetchOptions, 'body' | 'method'> = {}) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};