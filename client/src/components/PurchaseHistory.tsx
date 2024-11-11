import React, { useEffect, useState } from 'react';
import { api, PurchaseHistoryItem } from '@/lib/api';
import VideoPlayer from '@/components/features/videos/VideoPlayer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PaymentModal } from '@/components/features/videos/PaymentModal';
import { useRouter } from 'next/navigation';

const formatAmount = (amount: number | string) => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(numericAmount) ? numericAmount.toFixed(2) : '0.00';
};

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setLoading(true);
        const response = await api.payments.getPurchaseHistory({
          page: currentPage,
          limit: 10
        });
        setPurchases(response.purchases);
        setTotalPages(response.pages);
        setTotalItems(response.total);
      } catch (err) {
        console.error('Error fetching purchases:', err);
        setError('Failed to load purchase history');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [currentPage]);

  const handlePurchaseClick = (videoId: string) => {
    setSelectedVideo(videoId);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      router.push(`/payment/success?payment_intent=${paymentIntentId}&video_id=${selectedVideo}`);
    } catch (error) {
      console.error('Payment completion error:', error);
      setError('Failed to complete payment');
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" className="text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Purchase History</h1>
        <p className="text-sm text-gray-600">
          Showing {purchases.length} of {totalItems} purchases
        </p>
      </div>

      {purchases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No purchases yet</p>
        </div>
      ) : (
        <>
          <div className="grid gap-8">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="relative">
                  <VideoPlayer
                    videoId={purchase.videoId}
                    thumbnailUrl={purchase.video.thumbnailUrl}
                    initialUrls={{
                      streamingUrl: '',
                      previewUrl: '',
                      thumbnailUrl: purchase.video.thumbnailUrl
                    }}
                    isPurchased={purchase.status === 'completed'}
                    previewMode={purchase.status !== 'completed'}
                    onPurchaseClick={() => handlePurchaseClick(purchase.videoId)}
                  />
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {purchase.video.title}
                  </h3>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span 
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          purchase.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : purchase.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                      </span>
                      <span className="text-gray-500">
                        ${formatAmount(purchase.amount)}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      Purchased on: {new Date(purchase.createdAt).toLocaleDateString()}
                      {purchase.completedAt && (
                        <span className="ml-2 text-green-600">
                          • Completed on: {new Date(purchase.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {showPaymentModal && selectedVideo && (
        <PaymentModal
          videoId={selectedVideo}
          price={parseFloat(formatAmount(purchases.find(p => p.videoId === selectedVideo)?.amount || 0))}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedVideo(null);
          }}
          onSuccess={handlePaymentSuccess}
          isLoading={false}
        />
      )}
    </div>
  );
}