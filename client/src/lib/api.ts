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
  status_code?: number;
}

export class ApiException extends Error {
  code: string;
  status?: number;
  errors?: { field: string; message: string; }[];

  constructor(message: string, code: string, status?: number, errors?: { field: string; message: string; }[]) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

export interface ApiResponse<T> {
  status: 'success';
  data: T;
}

export interface UploadProgressEvent {
  loaded: number;
  total: number;
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retries?: number;
  body?: FormData | string | object;
  onUploadProgress?: (event: UploadProgressEvent) => void;
}

const DEFAULT_RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1000;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseXHRHeaders(xhr: XMLHttpRequest): HeadersInit {
  const headerString = xhr.getAllResponseHeaders();
  const headerPairs = headerString.trim().split(/[\r\n]+/);
  const headerMap: Record<string, string> = {};
  
  headerPairs.forEach(line => {
    const parts = line.split(': ');
    const header = parts.shift();
    const value = parts.join(': ');
    if (header) {
      headerMap[header.toLowerCase()] = value;
    }
  });
  
  return headerMap;
}

async function refreshToken(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      return null;
    }

    const data = await response.json();
    localStorage.setItem('auth_token', data.token);
    return data.token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

function createXHRPromise(
  request: Request,
  headers: Record<string, string>,
  onUploadProgress?: (event: UploadProgressEvent) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onUploadProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onUploadProgress({
            loaded: event.loaded,
            total: event.total
          });
        }
      };
    }

    xhr.onload = () => {
      const responseData = xhr.response;
      resolve(new Response(responseData, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseXHRHeaders(xhr)
      }));
    };

    xhr.onerror = () => {
      reject(new Error('Network request failed'));
    };

    xhr.open(request.method || 'GET', request.url);

    // Set request headers
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    // Send the request
    const body = request.body;
    if (body instanceof FormData) {
      xhr.send(body);
    } else if (body) {
      if (body instanceof ReadableStream) {
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        reader.read().then(function processText({ done, value }) {
          if (done) {
            const blob = new Blob(chunks);
            xhr.send(blob);
            return;
          }
          chunks.push(value);
          reader.read().then(processText);
        });
      } else {
        xhr.send(body as XMLHttpRequestBodyInit);
      }
    } else {
      xhr.send();
    }
  });
}

export async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    skipAuth = false,
    retries = DEFAULT_RETRY_COUNT,
    onUploadProgress,
    ...fetchOptions
  } = options;

  let attemptCount = 0;

  while (attemptCount <= retries) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...options.headers,
      };

      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      if (!skipAuth) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const url = `${API_URL}${endpoint}`;
      const body = options.body instanceof FormData
        ? options.body
        : options.body
        ? JSON.stringify(options.body)
        : undefined;

      let response: Response;
      
      if (onUploadProgress && options.body instanceof FormData) {
        const request = new Request(url, {
          ...fetchOptions,
          headers,
          body: options.body
        });
        
        response = await createXHRPromise(request, headers, onUploadProgress);
      } else {
        response = await fetch(url, {
          ...fetchOptions,
          headers,
          body
        });
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY_MS;
        await delay(delayMs);
        attemptCount++;
        continue;
      }

      if (response.status === 401 && !skipAuth && attemptCount === 0) {
        const newToken = await refreshToken();
        if (newToken) {
          attemptCount++;
          continue;
        }
      }

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        throw new ApiException(
          errorData.message || 'API request failed',
          errorData.code || 'UNKNOWN_ERROR',
          response.status,
          errorData.errors
        );
      }

      return (data as ApiResponse<T>).data;
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'TypeError' && attemptCount < retries) {
        await delay(RETRY_DELAY_MS * Math.pow(2, attemptCount));
        attemptCount++;
        continue;
      }

      throw new ApiException(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        'NETWORK_ERROR',
        undefined
      );
    }
  }

  throw new ApiException(
    'Maximum retry attempts reached',
    'MAX_RETRIES_EXCEEDED',
    undefined
  );
}

export const api = {
  get: <T>(endpoint: string, options: Omit<FetchOptions, 'body' | 'method'> = {}) => 
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(
    endpoint: string,
    data?: FormData | object,
    options: Omit<FetchOptions, 'body' | 'method'> = {}
  ) => fetchApi<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data,
  }),

  put: <T>(
    endpoint: string,
    data?: FormData | object,
    options: Omit<FetchOptions, 'body' | 'method'> = {}
  ) => fetchApi<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data,
  }),

  patch: <T>(
    endpoint: string,
    data?: FormData | object,
    options: Omit<FetchOptions, 'body' | 'method'> = {}
  ) => fetchApi<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data,
  }),

  delete: <T>(endpoint: string, options: Omit<FetchOptions, 'body' | 'method'> = {}) => 
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};