import api from "@/lib/api-client";
import { useRouter } from "next/dist/client/components/navigation";
import { useState } from "react";

// New file: src/components/features/seller/StripeConnect.tsx
export function StripeConnect() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
  
    const handleConnect = async () => {
      try {
        setIsLoading(true);
        const response = await api.post('/api-client/seller/connect-account');
        if (response.data?.url) {
          router.push(response.data.url);
        }
      } catch (error) {
        console.error('Failed to create connect account:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold mb-4">Start Selling Videos</h2>
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          {isLoading ? 'Connecting...' : 'Connect with Stripe'}
        </button>
      </div>
    );
  }