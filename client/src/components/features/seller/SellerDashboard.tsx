// src/components/features/seller/SellerDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface SellerStatus {
  stripeConnectStatus: 'none' | 'pending' | 'active' | 'rejected';
  accountLink?: string;
}

export function SellerDashboard() {
  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchSellerStatus();
  }, []);

  const fetchSellerStatus = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<SellerStatus>('/api/seller/account-status');
      setStatus(response);
    } catch (error) {
      setError('Failed to fetch seller status');
      console.error('Error fetching seller status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBecomeSellerClick = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<{ url: string }>('/api/seller/connect-account');
      
      // Redirect to Stripe Connect onboarding
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error) {
      setError('Failed to start seller onboarding');
      console.error('Error starting seller onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Seller Dashboard</h2>

      {status?.stripeConnectStatus === 'none' && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-4">Start Selling Your Videos</h3>
          <p className="text-gray-600 mb-6">
            Connect your Stripe account to receive payments from your video sales.
          </p>
          <button
            onClick={handleBecomeSellerClick}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Become a Seller
          </button>
        </div>
      )}

      {status?.stripeConnectStatus === 'pending' && (
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">
            Complete Your Seller Setup
          </h3>
          <p className="text-yellow-700 mb-4">
            Your seller account is pending. Please complete the Stripe onboarding process.
          </p>
          <button
            onClick={handleBecomeSellerClick}
            className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
          >
            Complete Setup
          </button>
        </div>
      )}

      {status?.stripeConnectStatus === 'active' && (
        <div className="space-y-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-green-700">
              Your seller account is active and ready to receive payments!
            </p>
          </div>
          
          {/* Add seller stats, balance, etc. here */}
        </div>
      )}

      {status?.stripeConnectStatus === 'rejected' && (
        <div className="bg-red-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-red-800 mb-2">
            Account Setup Failed
          </h3>
          <p className="text-red-700 mb-4">
            Your seller account was rejected. Please try again or contact support.
          </p>
          <button
            onClick={handleBecomeSellerClick}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}