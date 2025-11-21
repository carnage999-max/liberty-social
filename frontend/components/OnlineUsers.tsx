'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { API_BASE } from '@/lib/api';

interface Friend {
  id: string;
  username: string;
  profile_image_url: string | null;
  is_online: boolean;
  last_seen: string;
}

interface FriendData {
  friend: Friend;
}

interface OnlineUsersProps {
  /**
   * Maximum number of users to display
   * @default 8
   */
  maxUsers?: number;
  /**
   * Optional CSS class name for container customization
   */
  className?: string;
  /**
   * Optional title for the component
   * @default "Online Friends"
   */
  title?: string;
  /**
   * Callback when a user is clicked
   */
  onUserClick?: (user: Friend) => void;
}

/**
 * OnlineUsers Component
 *
 * Displays currently online friends in a story-style card layout with gradient background.
 * Falls back to recently active friends if none are online.
 * Features red/blue gradient background with golden text accents and online status indicators.
 *
 * Usage:
 * ```tsx
 * <OnlineUsers maxUsers={8} title="Who's Online?" />
 * ```
 */
export default function OnlineUsers({
  maxUsers = 8,
  className = '',
  title = 'Who\'s Online?',
  onUserClick,
}: OnlineUsersProps) {
  const { user: currentUser, accessToken } = useAuth();
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showingType, setShowingType] = useState<'online' | 'recent'>('online');

  // Format last seen time
  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays <= 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const fetchFriends = async () => {
      if (!accessToken) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch friends list
        const response = await fetch(`${API_BASE}/auth/friends/?page_size=100`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch friends');
        }

        const data = await response.json();
        const friendsList = (data.results || []).map((item: FriendData) => item.friend);

        if (friendsList.length === 0) {
          setError('You don\'t have any friends yet');
          setFriends([]);
          return;
        }

        // Separate online and recently active friends
        const onlineFriends = friendsList
          .filter((friend: Friend) => friend.is_online)
          .sort((a: Friend, b: Friend) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
          .slice(0, maxUsers);

        if (onlineFriends.length > 0) {
          setFriends(onlineFriends);
          setShowingType('online');
        } else {
          // No online friends, show recently active (up to 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const recentlyActiveFriends = friendsList
            .filter(
              (friend: Friend) =>
                !friend.is_online && new Date(friend.last_seen) > sevenDaysAgo
            )
            .sort((a: Friend, b: Friend) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
            .slice(0, maxUsers);

          if (recentlyActiveFriends.length > 0) {
            setFriends(recentlyActiveFriends);
            setShowingType('recent');
          } else {
            setError('No friends online or active in the last 7 days');
            setFriends([]);
          }
        }
      } catch (err) {
        console.error('Error fetching friends:', err);
        setError(err instanceof Error ? err.message : 'Failed to load friends');
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();

    // Refresh every 30 seconds
    const interval = setInterval(fetchFriends, 30000);

    return () => clearInterval(interval);
  }, [accessToken, maxUsers]);

  if (!currentUser) {
    return null;
  }

  if (loading && friends.length === 0) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-6 ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(30,58,138,0.1) 100%)',
        }}
      >
        <div className="h-6 w-32 animate-pulse rounded bg-gray-300"></div>
        <div className="mt-4 flex gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 w-20 animate-pulse rounded-lg bg-gray-300"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && friends.length === 0) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-6 ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(30,58,138,0.1) 100%)',
        }}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-400">
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm6 8v-1a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">{error}</p>
            <p className="mt-1 text-xs text-gray-500">
              {error?.includes('don\'t have') 
                ? 'Start adding friends to see their status'
                : 'Check back later when your friends are online'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return null;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl p-6 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #dc2626 0%, #1e3a8a 100%)',
      }}
    >
      {/* Decorative gradient overlay for depth */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: 'radial-gradient(circle at top right, rgba(255,255,255,0.3), transparent)',
        }}
      ></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header with title and type indicator */}
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="text-lg font-bold"
            style={{ color: '#fbbf24' }} // Golden text
          >
            {title}
          </h3>
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              color: '#fbbf24',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
            }}
          >
            {showingType === 'online' ? '🟢 Online' : '📍 Recently Active'}
          </span>
        </div>

        {/* Friends Horizontal Scroll */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory">
          {friends.map((friend) => (
            <div key={friend.id} className="group shrink-0 w-24 snap-start">
              <button
                onClick={() => onUserClick?.(friend)}
                className="relative w-full transition-transform duration-200 hover:scale-105 focus:outline-none"
              >
                {/* Friend Card */}
                <div className="relative">
                  {/* Avatar Container */}
                  <div className="relative inline-block w-full">
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-yellow-300 bg-gray-200 shadow-lg">
                      {friend.profile_image_url ? (
                        <Image
                          src={friend.profile_image_url}
                          alt={friend.username || 'Friend'}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100px, (max-width: 768px) 80px, 100px"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{
                            background: 'linear-gradient(to bottom right, rgb(248,113,113), rgb(37,99,235))',
                          }}
                        >
                          <span className="text-xl font-bold text-white">
                            {(friend.username?.[0] || 'F').toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Online/Offline Indicator Dot */}
                    {friend.is_online ? (
                      <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow-md"></div>
                    ) : (
                      <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-gray-400 shadow-md"></div>
                    )}
                  </div>

                  {/* Username and Status Label */}
                  <div className="mt-2 truncate">
                    <p
                      className="truncate text-xs font-semibold"
                      style={{ color: '#fbbf24' }} // Golden text
                    >
                      @{friend.username}
                    </p>
                    <p className="truncate text-xs text-white/70 mt-0.5">
                      {friend.is_online ? 'online' : formatLastSeen(friend.last_seen)}
                    </p>
                  </div>
                </div>
              </button>

              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 transform rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                <div>{friend.username}</div>
                <div className="text-gray-300">
                  {friend.is_online ? 'Online now' : formatLastSeen(friend.last_seen)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer - View all link */}
        {friends.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              href="/app/friends"
              className="text-xs font-semibold transition-colors duration-200"
              style={{ color: '#fbbf24' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fcd34d'; // Lighter gold on hover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#fbbf24'; // Back to normal gold
              }}
            >
              View all friends →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
