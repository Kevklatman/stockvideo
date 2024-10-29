// app/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchApi(endpoint: string, options = { headers: {} }) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error('API request failed');
  }
  
  return response.json();
}