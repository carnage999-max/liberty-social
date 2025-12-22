'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateYardSaleForm } from '@/components/CreateYardSaleForm';

export default function CreateYardSalePage() {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => {
      router.push('/yard-sales');
    }, 2000);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', paddingTop: '2rem', paddingBottom: '2rem' }}>
      {showSuccess && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>Success!</h2>
          <p style={{ color: '#666' }}>Your yard sale is now live on the map</p>
        </div>
      )}

      <CreateYardSaleForm onSuccess={handleSuccess} />
    </div>
  );
}
