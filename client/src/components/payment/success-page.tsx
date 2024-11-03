import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
// Add to app/(routes)/payment/success/page.tsx
export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get session ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (!sessionId) {
          setError('Invalid session ID');
          setStatus('error');
          return;
        }

        // Verify payment with backend
        const response = await fetch(`/api/payments/verify/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Payment verification failed');
        }

        const data = await response.json();

        if (data.data?.verified) {
          setStatus('success');
          // Redirect after a short delay
          setTimeout(() => {
            router.push('/videos');
          }, 2000);
        } else {
          throw new Error('Payment not verified');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment verification failed');
        setStatus('error');
      }
    };

    if (user) {
      verifyPayment();
    }
  }, [user, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner size="large" className="mb-4" />
        <p className="text-gray-600">Verifying your payment...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-red-50 p-6 rounded-lg text-center">
          <h2 className="text-red-800 text-xl font-semibold mb-2">Payment Error</h2>
          <p className="text-red-600">{error || 'An error occurred during payment verification'}</p>
          <button 
            onClick={() => router.push('/videos')}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            Return to Videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="bg-green-50 p-6 rounded-lg text-center">
        <h2 className="text-green-800 text-xl font-semibold mb-2">Payment Successful!</h2>
        <p className="text-green-600">Thank you for your purchase.</p>
        <p className="text-green-600 text-sm mt-2">Redirecting you to videos...</p>
      </div>
    </div>
  );
}
