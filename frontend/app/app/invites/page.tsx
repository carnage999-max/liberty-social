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
    slug?: string;
    category: string;
    profile_image_url?: string;
  };
  sender: {
    id: string;
    username: string;
    email: string;
    profile_image_url?: string;
  };
  recipient: {
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
  const [allInvites, setAllInvites] = useState<PageInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<PageInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<'pending' | 'accepted' | 'declined' | 'sent' | null>('pending');

  useEffect(() => {
    if (!accessToken) return;
    loadInvites();
  }, [accessToken]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const [receivedResponse, sentResponse] = await Promise.all([
        apiGet('/page-invites/', { token: accessToken }),
        apiGet('/page-invites/sent/', { token: accessToken }),
      ]);
      const receivedList = Array.isArray(receivedResponse) ? receivedResponse : receivedResponse?.results || [];
      const sentList = Array.isArray(sentResponse) ? sentResponse : sentResponse?.results || [];
      setAllInvites(receivedList);
      setSentInvites(sentList);
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
        // Update the invite status locally
        setAllInvites(allInvites.map(inv => 
          inv.id === inviteId ? { ...inv, status: 'accepted' } : inv
        ));
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
      
      toast.show('Invite declined', 'error');
      // Update the invite status locally
      setAllInvites(allInvites.map(inv => 
        inv.id === inviteId ? { ...inv, status: 'declined' } : inv
      ));
    } catch (error) {
      console.error('Failed to decline invite:', error);
      toast.show('Failed to decline invite', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingInvites = allInvites.filter(inv => inv.status === 'pending');
  const acceptedInvites = allInvites.filter(inv => inv.status === 'accepted');
  const declinedInvites = allInvites.filter(inv => inv.status === 'declined');

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
        <h1 className="text-3xl font-bold text-(--color-gold)">Page Invites</h1>
        <p className="text-gray-300">Invites to follow pages from your friends</p>
      </div>

      {allInvites.length === 0 && sentInvites.length === 0 ? (
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
          <p className="mt-4 text-gray-600">No invites yet</p>
          <p className="text-sm text-gray-500">
            When friends invite you to follow their pages, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pending Invites Accordion */}
          {pendingInvites.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => setExpandedAccordion(expandedAccordion === 'pending' ? null : 'pending')}
                className="flex w-full items-center justify-between px-6 py-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Pending Invites
                  </h2>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
                    {pendingInvites.length}
                  </span>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-600 transition ${expandedAccordion === 'pending' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              
              {expandedAccordion === 'pending' && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="space-y-4">
                    {pendingInvites.map((invite) => (
                      <InviteCard
                        key={invite.id}
                        invite={invite}
                        onAccept={() => handleAccept(invite.id)}
                        onDecline={() => handleDecline(invite.id)}
                        isProcessing={processingId === invite.id}
                        showActions={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Accepted Invites Accordion */}
          {acceptedInvites.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => setExpandedAccordion(expandedAccordion === 'accepted' ? null : 'accepted')}
                className="flex w-full items-center justify-between px-6 py-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Accepted Invites
                  </h2>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-xs font-semibold text-green-900">
                    {acceptedInvites.length}
                  </span>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-600 transition ${expandedAccordion === 'accepted' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              
              {expandedAccordion === 'accepted' && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="space-y-4">
                    {acceptedInvites.map((invite) => (
                      <InviteCard
                        key={invite.id}
                        invite={invite}
                        onAccept={() => {}}
                        onDecline={() => {}}
                        isProcessing={false}
                        showActions={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Declined Invites Accordion */}
          {declinedInvites.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => setExpandedAccordion(expandedAccordion === 'declined' ? null : 'declined')}
                className="flex w-full items-center justify-between px-6 py-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Declined Invites
                  </h2>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-xs font-semibold text-red-900">
                    {declinedInvites.length}
                  </span>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-600 transition ${expandedAccordion === 'declined' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              
              {expandedAccordion === 'declined' && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="space-y-4">
                    {declinedInvites.map((invite) => (
                      <InviteCard
                        key={invite.id}
                        invite={invite}
                        onAccept={() => {}}
                        onDecline={() => {}}
                        isProcessing={false}
                        showActions={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sent Invites Accordion */}
          {sentInvites.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => setExpandedAccordion(expandedAccordion === 'sent' ? null : 'sent')}
                className="flex w-full items-center justify-between px-6 py-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Sent Invites
                  </h2>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-xs font-semibold text-blue-900">
                    {sentInvites.length}
                  </span>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-600 transition ${expandedAccordion === 'sent' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              
              {expandedAccordion === 'sent' && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="space-y-4">
                    {sentInvites.map((invite) => (
                      <SentInviteCard
                        key={invite.id}
                        invite={invite}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InviteCard({
  invite,
  onAccept,
  onDecline,
  isProcessing,
  showActions,
}: {
  invite: PageInvite;
  onAccept: () => void;
  onDecline: () => void;
  isProcessing: boolean;
  showActions: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 pb-4 border-b border-gray-100 last:pb-0 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      {/* Page and Sender Info */}
      <div className="flex gap-4 flex-1 min-w-0">
        {/* Page Image */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {invite.page.profile_image_url ? (
            <img
              src={invite.page.profile_image_url}
              alt={invite.page.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-700">
              {invite.page.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/app/pages/${invite.page.slug ?? invite.page.id}`}
            className="inline-block"
          >
            <h3 className="text-base font-semibold text-gray-900 hover:underline">
              {invite.page.name}
            </h3>
          </Link>
          <p className="text-sm text-gray-600 capitalize">
            {invite.page.category}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-gray-100">
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
      {showActions && (
        <div className="flex gap-2 sm:shrink-0 w-full sm:w-auto">
          <button
            onClick={onDecline}
            disabled={isProcessing}
            className="flex-1 sm:flex-none rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={isProcessing}
            className="flex-1 sm:flex-none rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--color-primary)/90 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Accept'}
          </button>
        </div>
      )}
    </div>
  );
}

function SentInviteCard({
  invite,
}: {
  invite: PageInvite;
}) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
            <span className="h-2 w-2 rounded-full bg-amber-600"></span>
            Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900">
            <span className="h-2 w-2 rounded-full bg-green-600"></span>
            Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900">
            <span className="h-2 w-2 rounded-full bg-red-600"></span>
            Declined
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4 border-b border-gray-100 last:pb-0 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      {/* Page and Recipient Info */}
      <div className="flex gap-4 flex-1 min-w-0">
        {/* Page Image */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {invite.page.profile_image_url ? (
            <img
              src={invite.page.profile_image_url}
              alt={invite.page.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-700">
              {invite.page.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/app/pages/${invite.page.slug ?? invite.page.id}`}
            className="inline-block"
          >
            <h3 className="text-base font-semibold text-gray-900 hover:underline">
              {invite.page.name}
            </h3>
          </Link>
          <p className="text-sm text-gray-600 capitalize">
            {invite.page.category}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-gray-100">
              {invite.recipient.profile_image_url ? (
                <img
                  src={invite.recipient.profile_image_url}
                  alt={invite.recipient.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-700">
                  {invite.recipient.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600">
              Sent to{' '}
              <span className="font-semibold text-gray-900">
                {invite.recipient.username || invite.recipient.email}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="sm:shrink-0">
        {getStatusBadge(invite.status)}
      </div>
    </div>
  );
}
