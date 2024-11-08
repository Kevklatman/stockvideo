import React, { useEffect, useState } from 'react';
import { api, PurchaseHistoryResponse } from '@/lib/api';


const PurchaseHistory: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseHistoryResponse['purchases']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const response = await api.get<PurchaseHistoryResponse>('/api/payments/purchases');
        setPurchases(response.purchases);
      } catch (err) {
        setError('Failed to fetch purchase history');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      <h1>Purchase History</h1>
      <ul>
        {purchases.map(purchase => (
          <li key={purchase.id}>
            <img src={purchase.video.thumbnailUrl} alt={purchase.video.title} />
            <div>
              <h2>{purchase.video.title}</h2>
              <p>Status: {purchase.status}</p>
              <p>Amount: ${purchase.amount}</p>
              <p>Purchased on: {new Date(purchase.createdAt).toLocaleDateString()}</p>
              {purchase.completedAt && (
                <p>Completed on: {new Date(purchase.completedAt).toLocaleDateString()}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PurchaseHistory;
