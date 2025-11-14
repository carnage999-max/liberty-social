'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Spinner from '@/components/Spinner';

interface PageInvite {
  id: number;
  page: {
    id: number;
    name: string;
    category: string;
    profile_image_url?: string;
  };
  sender: {
    id: string;
    username: string;
    email: string;
    profile_image_url?: string;
  };
  status: string;
  created_at: string;
}

export default function InvitesPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [invites, setInvites] = useState<PageInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    loadInvites();
  }, [accessToken]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/page-invites/', { token: accessToken });
      const invitesList = Array.isArray(response) ? response : response?.results || [];
      // Filter to only pending invites
      setInvites(invitesList.filter((inv: PageInvite) => inv.status === 'pending'));
    } catch (error) {
      console.error('Failed to load invites:', error);
      toast.show('Failed to load invites', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (inviteId: number) => {
    try {
      setProcessingId(inviteId);
      const response = await apiPost(`/page-invites/${inviteId}/accept/`, {}, { token: accessToken });
      
      if (response) {
        toast.show('You are now following this page!', 'success');
        setInvites(invites.filter(inv => inv.id !== inviteId));
      }
    } catch (error) {
      console.error('Failed to accept invite:', error);
      toast.show('Failed to accept invite', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (inviteId: number) => {
    try {
      setProcessingId(inviteId);
      await apiPost(`/page-invites/${inviteId}/decline/`, {}, { token: accessToken });
      
      toast.show('Invite declined', 'info');
      setInvites(invites.filter(inv => inv.id !== inviteId));
    } catch (error) {
      console.error('Failed to decline invite:', error);
      toast.show('Failed to decline invite', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Page Invites</h1>
        <p className="text-gray-600">Invites to follow pages from your friends</p>
      </div>

      {invites.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="mt-4 text-gray-600">No pending invites yet</p>
          <p className="text-sm text-gray-500">
            When friends invite you to follow their pages, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Page and Sender Info */}
                <div className="flex gap-4 flex-1 min-w-0">
                  {/* Page Image */}
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {invite.page.profile_image_url ? (
                      <img
                        src={invite.page.profile_image_url}
                        alt={invite.page.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-gray-700">
                        {invite.page.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/app/pages/${invite.page.id}`}
                      className="inline-block"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 hover:underline">
                        {invite.page.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-600 capitalize">
                      {invite.page.category}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
                        {invite.sender.profile_image_url ? (
                          <img
                            src={invite.sender.profile_image_url}
                            alt={invite.sender.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-700">
                            {invite.sender.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        Invited by{' '}
                        <span className="font-semibold text-gray-900">
                          {invite.sender.username || invite.sender.email}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 sm:flex-shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => handleDecline(invite.id)}
                    disabled={processingId === invite.id}
                    className="flex-1 sm:flex-none rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleAccept(invite.id)}
                    disabled={processingId === invite.id}
                    className="flex-1 sm:flex-none rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
                  >
                    {processingId === invite.id ? 'Processing...' : 'Accept'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
