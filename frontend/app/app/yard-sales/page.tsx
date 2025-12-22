'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const YardSaleMap = dynamic(
  () => import('@/components/YardSaleMap').then(mod => ({ default: mod.YardSaleMap })),
  { 
    ssr: false,
    loading: () => <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: '#666' }}>Loading map...</div>
  }
);

export default function YardSalesPage() {
  return (
    <div style={{ height: '100vh' }}>
      <YardSaleMap />
    </div>
  );
}
