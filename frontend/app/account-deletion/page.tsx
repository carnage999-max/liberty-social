import React from 'react';
import { Metadata } from 'next';
import AccountDeletionClientPage from './page.client';

export const metadata: Metadata = {
  title: 'Request Account Deletion | Liberty Social',
  description: 'Request to permanently delete your Liberty Social account and all associated data.',
};

export default function AccountDeletionPage() {
  return <AccountDeletionClientPage />;
}
