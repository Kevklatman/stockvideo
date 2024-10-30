// src/app/register/page.tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { register, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMessage(null);
      await register(email, password);
      // Redirect on success
      // router.push('/dashboard');
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unexpected error occurred');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="text-red-500 p-2 bg-red-50 rounded">
          {errorMessage}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="email" className="block">
          Email
        </label>
        <input
          type="email"
          id="email"
          className="w-full p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block">
          Password
        </label>
        <input
          type="password"
          id="password"
          className="w-full p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button 
        type="submit" 
        disabled={isLoading}
        className="w-full bg-blue-500 text-white p-2 rounded disabled:bg-blue-300"
      >
        {isLoading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}