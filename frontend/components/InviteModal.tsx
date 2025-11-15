'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface Friend extends User {
  id: string;
  email: string;
  username: string;
}

interface InviteModalProps {
  pageId: number;
  isOpen: boolean;
  onClose: () => void;
  onInvitesSent?: () => void;
}

export default function InviteModal({
  pageId,
  isOpen,
  onClose,
  onInvitesSent,
}: InviteModalProps) {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Load friends list when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/auth/friends/', { token: accessToken });
      let friendsList: Friend[] = [];
      
      // Handle paginated response
      if (response.results && Array.isArray(response.results)) {
        // FriendsSerializer wraps friend data in a "friend" field
        friendsList = response.results.map((item: any) => item.friend).filter(Boolean);
      } else if (Array.isArray(response)) {
        friendsList = response.map((item: any) => item.friend || item).filter(Boolean);
      }
      
      setFriends(friendsList);
      setSelectedFriends(new Set());
    } catch (error) {
      console.error('Failed to load friends:', error);
      toast.show('Failed to load friends list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friendId: string | number) => {
    const newSelected = new Set(selectedFriends);
    const friendIdStr = String(friendId);
    if (newSelected.has(friendIdStr)) {
      newSelected.delete(friendIdStr);
    } else {
      newSelected.add(friendIdStr);
    }
    setSelectedFriends(newSelected);
  };

  const removeFriend = (friendId: string | number) => {
    const newSelected = new Set(selectedFriends);
    const friendIdStr = String(friendId);
    newSelected.delete(friendIdStr);
    setSelectedFriends(newSelected);
  };

  const sendInvites = async () => {
    if (selectedFriends.size === 0) {
      toast.show('Please select at least one friend', 'error');
      return;
    }

    try {
      setSending(true);
      // Convert friend IDs to integers
      const friendIds = Array.from(selectedFriends).map(id => {
        const parsed = parseInt(id, 10);
        return isNaN(parsed) ? id : parsed;
      });
      
      const response = await apiPost(
        `/pages/${pageId}/send-invites/`,
        {
          friend_ids: friendIds,
        },
        { token: accessToken }
      );

      if (response.total_sent > 0) {
        toast.show(
          `Invites sent to ${response.total_sent} friend${response.total_sent > 1 ? 's' : ''}!`,
          'success'
        );
        setSelectedFriends(new Set());
        onInvitesSent?.();
        onClose();
      }

      if (response.errors && response.errors.length > 0) {
        const errorCount = response.errors.length;
        toast.show(
          `${errorCount} invite${errorCount > 1 ? 's' : ''} could not be sent`,
          'error'
        );
      }
    } catch (error) {
      console.error('Failed to send invites:', error);
      // Extract error message from API error
      let errorMessage = 'Failed to send invites. Please try again.';
      if (error && typeof error === 'object') {
        const apiError = error as any;
        if (apiError.message) {
          errorMessage = apiError.message;
        } else if (apiError.detail) {
          errorMessage = apiError.detail;
        } else if (apiError.fieldErrors) {
          const fieldError = Object.entries(apiError.fieldErrors)[0];
          if (fieldError) {
            errorMessage = `${fieldError[0]}: ${(fieldError[1] as string[]).join(', ')}`;
          }
        }
      }
      toast.show(errorMessage, 'error');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const selectedFriendsArray = friends.filter((f) => selectedFriends.has(String(f.id)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Invite Friends to Follow
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition hover:text-gray-600"
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Selected Friends Pills */}
        {selectedFriendsArray.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Selected Friends</p>
            <div className="flex flex-wrap gap-2">
              {selectedFriendsArray.map((friend) => (
                <div
                  key={friend.id}
                  className="inline-flex items-center gap-2 rounded-full bg-(--color-deeper-navy) px-3 py-1 text-sm text-white border border-(--color-gold)"
                >
                  <span className='text-white'>{friend.username || friend.email}</span>
                  <button
                    onClick={() => removeFriend(friend.id)}
                    className="ml-1 transition hover:opacity-80"
                    aria-label={`Remove ${friend.username || friend.email}`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="max-h-96 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-(--color-primary)"></div>
            </div>
          ) : friends.length === 0 ? (
            <p className="text-center text-gray-600">No friends to invite</p>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <label
                  key={friend.id}
                  className="flex items-center gap-3 rounded-lg p-3 transition border border-(--color-gold) hover:bg-(--color-deep-navy) text-black bg-(--color-deeper-navy)"
                >
                  <input
                    type="checkbox"
                    checked={selectedFriends.has(String(friend.id))}
                    onChange={() => toggleFriend(friend.id)}
                    className="h-4 w-4 rounded border-(--color-gold) text-black transition"
                  />
                  <div className="flex flex-1 items-center gap-3">
                    {friend.profile_image_url && (
                      <img
                        src={friend.profile_image_url}
                        alt={friend.username || friend.email}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-(--color-silver-light)">
                        {friend.username || friend.email}
                      </p>
                      {friend.bio && (
                        <p className="truncate text-xs text-gray-400">{friend.bio}</p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 bg-gray-50 p-4">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={sendInvites}
            disabled={sending || selectedFriends.size === 0}
            className="flex-1 rounded-lg bg-(--color-deeper-navy) px-4 py-2 font-medium text-(--color-silver-mid) transition hover:bg-(--color-deep-navy)/90 disabled:opacity-50 border border-(--color-gold)"
          >
            {sending ? 'Sending...' : `Send (${selectedFriends.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
