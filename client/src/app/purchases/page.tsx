'use client';
import React from 'react';
import PurchaseHistory from '@/components/PurchaseHistory';

console.log('PurchaseHistory:', PurchaseHistory);

const PurchasesPage: React.FC = () => {
  return (
    <div>
      <PurchaseHistory />
    </div>
  );
};

export default PurchasesPage;
