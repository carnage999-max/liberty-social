"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";

type SearchResult = {
  id: number;
  type: "post" | "user" | "page";
  title: string;
  description?: string;
  image?: string;
  href: string;
};

export default function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !accessToken) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        // Search posts
        const postsResponse = await apiGet(
          `/posts/?search=${encodeURIComponent(searchQuery)}&page_size=5`,
          { token: accessToken }
        );

        const postResults: SearchResult[] = (postsResponse.results || []).map(
          (post: any) => ({
            id: post.id,
            type: "post",
            title: post.content.substring(0, 50) + (post.content.length > 50 ? "..." : ""),
            description: post.author?.username || "Unknown",
            href: `/app/feed/${post.id}`,
          })
        );

        // Search users
        const usersResponse = await apiGet(
          `/auth/users/?search=${encodeURIComponent(searchQuery)}&page_size=5`,
          { token: accessToken }
        );

        const userResults: SearchResult[] = (usersResponse.results || []).map(
          (user: any) => ({
            id: user.id,
            type: "user",
            title: user.username || user.email,
            description: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
            image: user.profile_image_url,
            href: `/app/users/${user.id}`,
          })
        );

        // Search pages
        const pagesResponse = await apiGet(
          `/pages/?search=${encodeURIComponent(searchQuery)}&page_size=5`,
          { token: accessToken }
        );

        const pageResults: SearchResult[] = (pagesResponse.results || []).map(
          (page: any) => ({
            id: page.id,
            type: "page",
            title: page.name,
            description: page.description?.substring(0, 50),
            image: page.cover_image_url,
            href: `/app/pages/${page.id}`,
          })
        );

        setResults([...postResults, ...userResults, ...pageResults].slice(0, 15));
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [accessToken]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Debounce search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value.trim()) {
        searchTimeoutRef.current = setTimeout(() => {
          performSearch(value);
        }, 300);
      } else {
        setResults([]);
      }
    },
    [performSearch]
  );

  const handleResultClick = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
      setQuery("");
      setResults([]);
    },
    [router, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col sm:items-start sm:pt-20 sm:px-4">
      <div className="w-full bg-white shadow-lg sm:rounded-lg sm:max-w-md">
        {/* Search Header */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search posts, people, pages..."
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
                setQuery("");
                setResults([]);
              }
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                searchInputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            </div>
          ) : results.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => handleResultClick(result.href)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-start gap-3"
                  >
                    {/* Icon/Avatar */}
                    <div className="flex-shrink-0">
                      {result.type === "post" && (
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          📝
                        </div>
                      )}
                      {result.type === "user" && (
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200">
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-purple-600 text-white font-bold text-xs">
                              {result.title.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      )}
                      {result.type === "page" && (
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-200">
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 text-white font-bold text-xs">
                              📄
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Result Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </h3>
                      {result.description && (
                        <p className="text-xs text-gray-500 truncate">
                          {result.description}
                        </p>
                      )}
                    </div>

                    {/* Badge */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {result.type === "post" && "Post"}
                        {result.type === "user" && "Person"}
                        {result.type === "page" && "Page"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Start typing to search Liberty Social
            </div>
          )}
        </div>
      </div>

      {/* Close on backdrop click */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
        role="presentation"
      />
    </div>
  );
}
