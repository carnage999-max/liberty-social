"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";

type SearchResult = {
  id: number;
  type: "post" | "user" | "page" | "marketplace" | "animal" | "breeder";
  title: string;
  description?: string;
  image?: string;
  href: string;
};

type SearchTab = "all" | "post" | "user" | "page" | "marketplace" | "animal" | "breeder";

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
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [posts, setPosts] = useState<SearchResult[]>([]);
  const [users, setUsers] = useState<SearchResult[]>([]);
  const [pages, setPages] = useState<SearchResult[]>([]);
  const [marketplace, setMarketplace] = useState<SearchResult[]>([]);
  const [animals, setAnimals] = useState<SearchResult[]>([]);
  const [breeders, setBreeders] = useState<SearchResult[]>([]);
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
    async (searchQuery: string, entityType: SearchTab = "all") => {
      if (!searchQuery.trim() || !accessToken) {
        setAllResults([]);
        setPosts([]);
        setUsers([]);
        setPages([]);
        setMarketplace([]);
        setAnimals([]);
        setBreeders([]);
        return;
      }

      setSearching(true);
      try {
        const response = await apiGet(
          `/search/?q=${encodeURIComponent(searchQuery)}&type=${entityType}`,
          { token: accessToken }
        );

        if (entityType === "all") {
          setAllResults(response.all || []);
          setPosts(response.posts || []);
          setUsers(response.users || []);
          setPages(response.pages || []);
          setMarketplace(response.marketplace || []);
          setAnimals(response.animals || []);
          setBreeders(response.breeders || []);
        } else {
          // Update specific category
          switch (entityType) {
            case "post":
              setPosts(response.posts || []);
              break;
            case "user":
              setUsers(response.users || []);
              break;
            case "page":
              setPages(response.pages || []);
              break;
            case "marketplace":
              setMarketplace(response.marketplace || []);
              break;
            case "animal":
              setAnimals(response.animals || []);
              break;
            case "breeder":
              setBreeders(response.breeders || []);
              break;
          }
        }
      } catch (error) {
        console.error("Search failed:", error);
        setAllResults([]);
        setPosts([]);
        setUsers([]);
        setPages([]);
        setMarketplace([]);
        setAnimals([]);
        setBreeders([]);
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
          performSearch(value, activeTab);
        }, 300);
      } else {
        setAllResults([]);
        setPosts([]);
        setUsers([]);
        setPages([]);
        setMarketplace([]);
        setAnimals([]);
        setBreeders([]);
      }
    },
    [performSearch, activeTab]
  );

  const handleTabChange = useCallback(
    (tab: SearchTab) => {
      setActiveTab(tab);
      if (query.trim()) {
        performSearch(query, tab);
      }
    },
    [query, performSearch]
  );

  const handleResultClick = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
      setQuery("");
      setAllResults([]);
      setPosts([]);
      setUsers([]);
      setPages([]);
      setMarketplace([]);
      setAnimals([]);
      setBreeders([]);
    },
    [router, onClose]
  );

  const getCurrentResults = (): SearchResult[] => {
    switch (activeTab) {
      case "post":
        return posts;
      case "user":
        return users;
      case "page":
        return pages;
      case "marketplace":
        return marketplace;
      case "animal":
        return animals;
      case "breeder":
        return breeders;
      default:
        return allResults;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "post":
        return "📝";
      case "user":
        return "👤";
      case "page":
        return "📄";
      case "marketplace":
        return "🛒";
      case "animal":
        return "🐾";
      case "breeder":
        return "🏆";
      default:
        return "🔍";
    }
  };

  const getResultLabel = (type: string) => {
    switch (type) {
      case "post":
        return "Post";
      case "user":
        return "Person";
      case "page":
        return "Page";
      case "marketplace":
        return "Marketplace";
      case "animal":
        return "Animal";
      case "breeder":
        return "Breeder";
      default:
        return "Result";
    }
  };

  const getResultGradient = (type: string) => {
    switch (type) {
      case "post":
        return "from-blue-400 to-blue-600";
      case "user":
        return "from-purple-400 to-purple-600";
      case "page":
        return "from-green-400 to-green-600";
      case "marketplace":
        return "from-orange-400 to-orange-600";
      case "animal":
        return "from-pink-400 to-pink-600";
      case "breeder":
        return "from-yellow-400 to-yellow-600";
      default:
        return "from-gray-400 to-gray-600";
    }
  };

  if (!open) return null;

  const currentResults = getCurrentResults();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col sm:items-start sm:pt-20 sm:px-4">
      <div className="w-full bg-white shadow-lg sm:rounded-lg sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Search Header */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 shrink-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-400"
          >
            <circle cx="11" cy="11" r="8" fill="none" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search posts, people, pages, marketplace..."
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
                setQuery("");
                setAllResults([]);
                setPosts([]);
                setUsers([]);
                setPages([]);
                setMarketplace([]);
                setAnimals([]);
                setBreeders([]);
              }
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setAllResults([]);
                setPosts([]);
                setUsers([]);
                setPages([]);
                setMarketplace([]);
                setAnimals([]);
                setBreeders([]);
                searchInputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tabs */}
        {query && (
          <div className="border-b border-gray-200 shrink-0 overflow-x-auto">
            <div className="flex gap-1 px-2 min-w-max">
              {(["all", "post", "user", "page", "marketplace", "animal", "breeder"] as SearchTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            </div>
          ) : currentResults.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {currentResults.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => handleResultClick(result.href)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-start gap-3"
                  >
                    {/* Icon/Avatar */}
                    <div className="flex-shrink-0">
                      {(result.type === "user" || result.type === "page") && result.image ? (
                        <div className={`h-10 w-10 ${result.type === "user" ? "rounded-full" : "rounded-lg"} overflow-hidden bg-gray-200`}>
                          <img
                            src={result.image}
                            alt={result.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className={`h-10 w-10 ${result.type === "user" ? "rounded-full" : "rounded-lg"} bg-gradient-to-br ${getResultGradient(result.type)} flex items-center justify-center text-white text-xs`}>
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{getResultIcon(result.type)}</span>
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
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {result.description}
                        </p>
                      )}
                    </div>

                    {/* Badge */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {getResultLabel(result.type)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No {activeTab === "all" ? "" : activeTab} results found for "{query}"
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
