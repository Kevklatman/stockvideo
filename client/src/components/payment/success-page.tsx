'use client';

// success-page.tsx
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle, XCircle } from 'lucide-react';
import { usePayment } from '@/hooks/usePayment';
import { Toast } from '@/components/Toast';

export default function PaymentSuccessPage() {
  const [mounted, setMounted] = useState(true);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyPayment } = usePayment();
  
  const paymentIntentId = searchParams?.get('payment_intent');

  // Handle component mounting/unmounting
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle payment verification
  useEffect(() => {
    if (!paymentIntentId || !mounted) {
      setStatus('error');
      setMessage('Invalid payment session');
      return;
    }

    let redirectTimer: NodeJS.Timeout;

    const verifyAndRedirect = async () => {
      try {
        const result = await verifyPayment(paymentIntentId);

        if (result.verified) {
          setStatus('success');
          setShowToast(true);
          redirectTimer = setTimeout(() => {
            if (mounted) {
              router.push('/videos');
            }
          }, 5000);
        } else if (result.purchase?.status === 'pending') {
          // Payment is still processing
          setTimeout(verifyAndRedirect, 2000); // Retry after 2 seconds
        } else {
          setStatus('error');
          setMessage('Payment verification failed. Please contact support if your payment was processed.');
        }
      } catch (err) {
        if (!mounted) return;
        
        console.error('Payment verification error:', err);
        setStatus('error');
        setMessage(err instanceof Error ? 
          err.message : 
          'Error verifying payment. Please contact support if your payment was processed.'
        );
      }
    };

    verifyAndRedirect();

    // Cleanup
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [paymentIntentId, router, mounted, verifyPayment]);

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <>
            <LoadingSpinner size="large" className="mb-6 text-blue-500" />
            <h2 className="text-2xl font-semibold mb-4">Processing Your Payment</h2>
            <p className="text-gray-600">
              Please wait while we verify your payment. You will be redirected automatically.
            </p>
          </>
        );

      case 'success':
        return (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mb-6" />
            <h2 className="text-2xl font-semibold mb-4">Payment Successful!</h2>
            <p className="text-gray-600">
              Thank you for your purchase. You will be redirected to your videos shortly.
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
      {showToast && (
        <Toast 
          message="Payment processed successfully!" 
          type="success"
          onClose={() => setShowToast(false)}
          duration={3000}
        />
      )}
      
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full mx-4">
        {renderContent()}
        
        <div className="mt-6 text-sm text-gray-500">
          {status !== 'error' && (
            <>
              Not redirected automatically?{' '}
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