'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface OnlineUser {
  id: string;
  username: string;
  profile_image_url: string | null;
  is_online: boolean;
  last_seen: string;
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
   * @default "Online Users"
   */
  title?: string;
  /**
   * Callback when a user is clicked
   */
  onUserClick?: (user: OnlineUser) => void;
}

/**
 * OnlineUsers Component
 *
 * Displays currently online users in a story-style card layout with gradient background.
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
  title = 'Online Users',
  onUserClick,
}: OnlineUsersProps) {
  const { user: currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('access_token');
        if (!token) {
          setError('Not authenticated');
          return;
        }

        const response = await fetch('/api/users/online/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch online users');
        }

        const data: OnlineUser[] = await response.json();
        setOnlineUsers(data.slice(0, maxUsers));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching online users:', err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchOnlineUsers();

    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineUsers, 30000);

    return () => clearInterval(interval);
  }, [maxUsers]);

  if (!currentUser) {
    return null;
  }

  if (error && !onlineUsers.length) {
    return (
      <div className={`p-4 text-center text-sm text-red-500 ${className}`}>
        Failed to load online users
      </div>
    );
  }

  if (loading && !onlineUsers.length) {
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

  if (!onlineUsers.length) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-6 text-center ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(30,58,138,0.1) 100%)',
        }}
      >
        <p className="text-sm text-gray-500">No users online right now</p>
      </div>
    );
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
        {/* Title */}
        <h3
          className="mb-4 text-lg font-bold"
          style={{ color: '#fbbf24' }} // Golden text
        >
          {title}
        </h3>

        {/* Online Users Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {onlineUsers.map((user) => (
            <div key={user.id} className="group">
              <button
                onClick={() => onUserClick?.(user)}
                className="relative w-full transition-transform duration-200 hover:scale-105 focus:outline-none"
              >
                {/* User Card */}
                <div className="relative">
                  {/* Avatar Container */}
                  <div className="relative inline-block w-full">
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-yellow-300 bg-gray-200 shadow-lg">
                      {user.profile_image_url ? (
                        <Image
                          src={user.profile_image_url}
                          alt={user.username || 'User'}
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
                            {(user.username?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Online Indicator Dot */}
                    {user.is_online && (
                      <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow-md"></div>
                    )}
                  </div>

                  {/* Username Label */}
                  <div className="mt-2 truncate">
                    <p
                      className="truncate text-xs font-semibold"
                      style={{ color: '#fbbf24' }} // Golden text
                    >
                      @{user.username}
                    </p>
                  </div>
                </div>
              </button>

              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 transform rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                {user.username}
              </div>
            </div>
          ))}
        </div>

        {/* Footer - View all link */}
        <div className="mt-4 text-center">
          <Link
            href="/app/online"
            className="text-xs font-semibold transition-colors duration-200"
            style={{ color: '#fbbf24' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fcd34d'; // Lighter gold on hover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#fbbf24'; // Back to normal gold
            }}
          >
            View all online users →
          </Link>
        </div>
      </div>
    </div>
  );
}
