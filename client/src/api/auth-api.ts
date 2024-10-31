// client/src/api/auth-api.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface User {
  id: string;
  email: string;
  role: string;
}

const authApi = {
  setAuthToken(token: string | null) {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await axios.post<LoginResponse>(`${API_URL}/auth/login`, { email, password });
    return response.data;
  },

  async register(email: string, password: string): Promise<RegisterResponse> {
    const response = await axios.post<RegisterResponse>(`${API_URL}/auth/register`, { email, password });
    return response.data;
  },

  async validateToken(): Promise<User> {
    const response = await axios.get<User>(`${API_URL}/auth/validate`);
    return response.data;
  }
};

export default authApi;