// success-page.tsx
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle, XCircle } from 'lucide-react';

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams?.get('payment_intent');

  useEffect(() => {
    if (!paymentIntentId) {
      setStatus('error');
      setMessage('Invalid payment session');
      return;
    }

    // Set up redirect timer
    const redirectTimer = setTimeout(() => {
      router.push('/videos');
    }, 5000);

    return () => clearTimeout(redirectTimer);
  }, [paymentIntentId, router]);

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <>
            <LoadingSpinner size="large" className="mb-6 text-blue-500" />
            <h2 className="text-2xl font-semibold mb-4">Processing Your Payment</h2>
            <p className="text-gray-600">
              Please wait while we process your payment. You will be redirected automatically.
            </p>
          </>
        );

      case 'success':
        return (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mb-6" />
            <h2 className="text-2xl font-semibold mb-4">Payment Successful!</h2>
            <p className="text-gray-600">
              Thank you for your purchase. You will be redirected shortly.
            </p>
          </>
        );

      case 'error':
        return (
          <>
            <XCircle className="w-16 h-16 text-red-500 mb-6" />
            <h2 className="text-2xl font-semibold mb-4">Payment Error</h2>
            <p className="text-red-600 mb-4">{message}</p>
            <button
              onClick={() => router.push('/videos')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Videos
            </button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full mx-4">
        {renderContent()}
        
        <div className="mt-6 text-sm text-gray-500">
          {status !== 'error' && (
            <>
              Not redirected?{' '}
              <button
                onClick={() => router.push('/videos')}
                className="text-blue-500 hover:underline"
              >
                Click here
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}