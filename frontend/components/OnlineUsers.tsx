'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { API_BASE } from '@/lib/api';

// Add simple waving flag animation
const flagStyle = `
  @keyframes rippleWave {
    0%, 100% {
      filter: brightness(1);
      transform: translateX(0px);
    }
    50% {
      filter: brightness(1.05);
      transform: translateX(2px);
    }
  }
  
  .flag-border {
    animation: rippleWave 2.5s ease-in-out infinite;
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = flagStyle;
  document.head.appendChild(style);
}

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
    <div className={`${className}`}>
      {/* Header with title */}
      <div className="mb-3 flex items-center justify-between px-1">
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
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 snap-x snap-mandatory">
          {friends.map((friend) => (
            <div key={friend.id} className="group shrink-0 snap-start">
              <button
                onClick={() => onUserClick?.(friend)}
                className="relative transition-transform duration-200 hover:scale-105 focus:outline-none"
              >
                {/* American Flag Border Container */}
                <div className="relative w-32 h-32 flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundImage: 'url(/flag-2.gif)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  {/* Circular Profile Image Container */}
                  <div className="relative w-24 h-24 rounded-full overflow-hidden z-10 border-2 border-white shadow-lg">
                    {/* Friend Card - Story Style */}
                    <div className="relative h-full w-full">
                      {/* Background Image or Gradient */}
                      {friend.profile_image_url ? (
                        <Image
                          src={friend.profile_image_url}
                          alt={friend.username || 'Friend'}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div
                          className="h-full w-full flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, #921414 0%, #1b2849 100%)',
                          }}
                        >
                          <span className="text-2xl font-bold text-white">
                            {(friend.username?.[0] || 'F').toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Dark overlay for text readability */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent"></div>
                    </div>
                  </div>

                  {/* Online Status Indicator - Positioned outside circle */}
                  <div className="absolute bottom-1 right-1 z-20">
                    {friend.is_online ? (
                      <div className="h-3 w-3 rounded-full border-2 border-white bg-green-500 shadow-md"></div>
                    ) : (
                      <div className="h-3 w-3 rounded-full border-2 border-white bg-gray-500 shadow-md"></div>
                    )}
                  </div>
                </div>

                {/* Username and Status - Below the flag border */}
                <div className="mt-2 text-center">
                  <p className="truncate text-xs font-semibold text-gray-800">
                    {friend.username}
                  </p>
                  <p className="truncate text-xs text-gray-600">
                    {friend.is_online ? 'Active now' : formatLastSeen(friend.last_seen)}
                  </p>
                </div>
              </button>
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
  );
}
