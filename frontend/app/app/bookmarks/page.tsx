"use client";

import Spinner from "@/components/Spinner";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Bookmark, Post, SaveFolder, SaveFolderItem } from "@/lib/types";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

type PostMap = Record<number, Post>;

type ViewMode = "all" | "folder";

export default function BookmarksPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const { items, loading, error, next, loadMore, loadingMore, refresh, count } =
    usePaginatedResource<Bookmark>("/bookmarks/");
  
  const [postsById, setPostsById] = useState<PostMap>({});
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [folders, setFolders] = useState<SaveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [removingPostId, setRemovingPostId] = useState<number | null>(null);

  // Load folders
  useEffect(() => {
    if (!accessToken) return;
    
    loadFolders();
  }, [accessToken]);

  const loadFolders = useCallback(async () => {
    if (!accessToken) return;
    setLoadingFolders(true);
    try {
      const response = await apiGet("/save-folders/", {
        token: accessToken,
        cache: "no-store",
      });
      const data = Array.isArray(response) ? response : response.results || [];
      setFolders(data);
      if (data.length > 0 && !selectedFolderId) {
        setSelectedFolderId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load save folders:", err);
    } finally {
      setLoadingFolders(false);
    }
  }, [accessToken, selectedFolderId]);

  useEffect(() => {
    if (!accessToken || items.length === 0) return;
    const missingIds = items
      .map((bookmark) => bookmark.post)
      .filter((postId) => !postsById[postId]);
    if (missingIds.length === 0) return;

    const controller = new AbortController();
    (async () => {
      try {
        const fetched = await Promise.all(
          missingIds.map((postId) =>
            apiGet<Post>(`/posts/${postId}/`, {
              token: accessToken,
              cache: "no-store",
              signal: controller.signal,
            }).catch(() => null)
          )
        );
        setPostsById((prev) => {
          const nextMap = { ...prev };
          fetched.forEach((post) => {
            if (post) nextMap[post.id] = post;
          });
          return nextMap;
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
      }
    })();
    return () => controller.abort();
  }, [accessToken, items, postsById]);

  const enrichedBookmarks = useMemo(
    () =>
      items.map((bookmark) => ({
        ...bookmark,
        post: postsById[bookmark.post],
      })),
    [items, postsById]
  );

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId]
  );

  const displayedItems = useMemo(() => {
    if (viewMode === "folder" && currentFolder) {
      return currentFolder.items || [];
    }
    return enrichedBookmarks;
  }, [viewMode, currentFolder, enrichedBookmarks]);

  const handleRemove = useCallback(
    async (bookmarkId: number) => {
      if (!accessToken) return;
      try {
        setRemovingId(bookmarkId);
        await apiDelete(`/bookmarks/${bookmarkId}/`, {
          token: accessToken,
          cache: "no-store",
        });
        await refresh();
        toast.show("Post removed from saves.");
      } catch (err) {
        console.error(err);
        toast.show("Unable to remove save. Please try again.", "error");
      } finally {
        setRemovingId(null);
      }
    },
    [accessToken, refresh, toast]
  );

  const handleRemoveFromFolder = useCallback(
    async (postId: number) => {
      if (!accessToken || !selectedFolderId) return;
      try {
        setRemovingPostId(postId);
        await apiPost(
          `/save-folders/${selectedFolderId}/remove_post/`,
          { post: postId },
          {
            token: accessToken,
            cache: "no-store",
          }
        );
        await loadFolders();
        toast.show("Post removed from folder.");
      } catch (err) {
        console.error(err);
        toast.show("Unable to remove post. Please try again.", "error");
      } finally {
        setRemovingPostId(null);
      }
    },
    [accessToken, selectedFolderId, loadFolders, toast]
  );

  const PostCard = ({ item, isFolder = false }: { item: any; isFolder?: boolean }) => {
    const post = isFolder ? item.post : item.post;
    const authorLabel = post
      ? post.author.username ||
        [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") ||
        post.author.email ||
        "User"
      : "User";

    return (
      <li
        key={isFolder ? item.id : item.id}
        className="rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              {isFolder ? "Saved" : "Bookmarked"}{" "}
              {new Date(item.created_at).toLocaleString()}
            </p>
            {post ? (
              <>
                <h2 className="mt-1 text-sm font-semibold text-gray-900">
                  {authorLabel}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-gray-700">
                  {post.content}
                </p>
                {post.media && post.media.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                    <Image
                      src={post.media[0]}
                      alt="Post media"
                      width={800}
                      height={400}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                This post is no longer available.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() =>
                isFolder
                  ? handleRemoveFromFolder(post.id)
                  : handleRemove(item.id)
              }
              disabled={
                isFolder
                  ? removingPostId === post.id
                  : removingId === item.id
              }
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFolder
                ? removingPostId === post.id
                  ? "Removing..."
                  : "Remove"
                : removingId === item.id
                ? "Removing..."
                : "Remove"}
            </button>
            {post && (
              <Link
                href={`/app/feed/${post.id}`}
                className="rounded-lg border border-(--color-deep-navy) px-3 py-1.5 text-xs font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white"
              >
                View post
              </Link>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold --color-silver-mid">Saved Posts</h1>
        <p className="text-sm text-gray-500">
          {viewMode === "folder" && currentFolder
            ? `${currentFolder.item_count} post${
                currentFolder.item_count === 1 ? "" : "s"
              } in "${currentFolder.name}"`
            : count === 0
            ? "You haven't saved anything yet."
            : `${count} save${count === 1 ? "" : "s"}`}
        </p>
      </header>

      {/* View mode tabs and folder selector */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("all")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                viewMode === "all"
                  ? "bg-[var(--color-primary)] text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              All Saves
            </button>
            <button
              onClick={() => setViewMode("folder")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                viewMode === "folder"
                  ? "bg-[var(--color-primary)] text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              By Folder
            </button>
          </div>

          {viewMode === "folder" && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {loadingFolders ? (
                <Spinner />
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedFolderId === folder.id
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {folder.name}
                    <span className="ml-2 text-xs opacity-75">({folder.item_count})</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {viewMode === "all" ? (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white/90 p-8 text-center shadow-sm">
              <p className="text-sm text-gray-700">{error}</p>
              <button
                onClick={() => refresh()}
                className="mt-4 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : enrichedBookmarks.length === 0 ? (
            <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">
                Nothing saved yet.
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                You can save posts to revisit them later organized in folders.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-4">
                {enrichedBookmarks.map((bookmark) => (
                  <PostCard key={bookmark.id} item={bookmark} />
                ))}
              </ul>
              {next && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {loadingFolders ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : !currentFolder ? (
            <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">No folders</h2>
              <p className="mt-2 text-sm text-gray-500">
                Create a folder when saving a post.
              </p>
            </div>
          ) : currentFolder.items.length === 0 ? (
            <div className="rounded-2xl bg-white/90 p-10 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">
                No posts in this folder yet.
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Add posts to "{currentFolder.name}" when saving them.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {currentFolder.items.map((item) => (
                <PostCard key={item.id} item={item} isFolder={true} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}



