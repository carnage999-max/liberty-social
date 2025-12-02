'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiPost } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import Link from 'next/link';

export default function AccountDeletionClientPage() {
  const { user, clearAuth, accessToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const { show } = useToast();

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmation.toLowerCase() !== 'delete') {
      show('Please type "delete" to confirm.', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/users/request-deletion/', {}, { token: accessToken });
      show('Your account deletion request has been submitted. You will receive a confirmation email shortly.', 'success');
      clearAuth();
      router.push('/');
    } catch (error) {
      console.error('Failed to request account deletion', error);
      show('An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background safe-pt safe-px safe-pb">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-textLight mb-4">
            Request Account Deletion
          </h1>
          <p className="text-lg text-textSecondary max-w-2xl mx-auto">
            This action is permanent and cannot be undone
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 md:p-8">
            {user ? (
              <form onSubmit={handleRequestDeletion} className="space-y-8">
                {/* Important Information Section */}
                <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-6">
                  <div className="flex items-start">
                    <svg className="w-6 h-6 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="ml-4">
                      <h2 className="text-xl font-bold text-red-900 mb-3">
                        Important Information
                      </h2>
                      <p className="text-red-800 mb-4 leading-relaxed">
                        You are about to request the permanent deletion of your Liberty Social account. This action is irreversible and will result in:
                      </p>
                      <ul className="space-y-3 text-red-800">
                        <li className="flex items-start">
                          <span className="text-red-600 mr-3 mt-1">•</span>
                          <span><strong>Permanent data deletion:</strong> All your profile information, posts, comments, and messages will be permanently deleted.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-600 mr-3 mt-1">•</span>
                          <span><strong>No account recovery:</strong> You will not be able to reactivate your account or recover any data.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-600 mr-3 mt-1">•</span>
                          <span><strong>Username availability:</strong> Your username will be freed up for other users.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-600 mr-3 mt-1">•</span>
                          <span><strong>Processing time:</strong> This process may take up to 30 days to complete.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Confirmation Input */}
                <div className="space-y-4">
                  <div className="border-t border-border pt-6">
                    <h3 className="text-lg font-semibold text-textLight mb-4">
                      Confirm Account Deletion
                    </h3>
                    <p className="text-textLight mb-4">
                      To confirm, please type the word <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-1 rounded">delete</span> into the box below and click the "Permanently Delete My Account" button.
                    </p>
                    <div>
                      <label htmlFor="confirmation" className="block text-sm font-medium text-textLight mb-2">
                        Type "delete" to confirm
                      </label>
                      <input
                        type="text"
                        name="confirmation"
                        id="confirmation"
                        className="w-full px-4 py-3 border border-border bg-background text-textLight rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-base"
                        placeholder="Type delete here"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        required
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-4 pt-6 border-t border-border">
                  <Link
                    href="/app/settings"
                    className="flex-1 inline-flex justify-center items-center py-3 px-6 border border-border rounded-lg text-base font-medium text-textLight bg-card hover:bg-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading || confirmation.toLowerCase() !== 'delete'}
                    className="flex-1 inline-flex justify-center items-center py-3 px-6 border border-transparent rounded-lg text-base font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Permanently Delete My Account'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-textSecondary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-lg font-semibold text-textLight mb-2">
                  Authentication Required
                </h3>
                <p className="text-textSecondary mb-6">
                  You must be logged in to request account deletion.
                </p>
                <Link 
                  href="/auth/login" 
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  Go to Login
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Support Information */}
        {user && (
          <div className="mt-8 text-center">
            <p className="text-textSecondary text-sm">
              Changed your mind? You can still cancel this request by logging in within 30 days. <br />
              Need help? <a href="mailto:support@mylibertysocial.com" className="text-primary hover:underline font-medium">Contact Support</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
