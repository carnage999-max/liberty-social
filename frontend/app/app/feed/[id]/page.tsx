"use client";

import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import type { Comment, Post, Reaction } from "@/lib/types";
import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ReactionBreakdown = {
  total: number;
  byType: Record<Reaction["reaction_type"], number>;
};

function summariseReactions(reactions: Reaction[]): ReactionBreakdown {
  return reactions.reduce<ReactionBreakdown>(
    (acc, reaction) => {
      acc.total += 1;
      acc.byType[reaction.reaction_type] += 1;
      return acc;
    },
    {
      total: 0,
      byType: { like: 0, love: 0, haha: 0, sad: 0, angry: 0 },
    }
  );
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id || !accessToken) return;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet<Post>(`/posts/${params.id}/`, {
          token: accessToken,
          cache: "no-store",
          signal: controller.signal,
        });
        setPost(data);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        if (err?.status === 404) {
          setPost(null);
          setError("Post not found.");
          return;
        }
        console.error(err);
        setError(err?.message || "Unable to load this post right now.");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [params?.id, accessToken]);

  const reactionSummary = useMemo(
    () => summariseReactions(post?.reactions ?? []),
    [post?.reactions]
  );

  return (
    <RequireAuth>
      <section className="min-h-screen bg-[var(--color-background)] pb-12 pt-20 sm:pt-24">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <Link
            href="/app/feed"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to feed
          </Link>

          <div className="mt-6 rounded-[18px] border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : error ? (
              <div className="text-center text-sm text-gray-600">
                <p>{error}</p>
                <button
                  onClick={() => router.refresh()}
                  className="mt-4 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
                >
                  Retry
                </button>
              </div>
            ) : !post ? (
              <div className="text-center text-sm text-gray-600">
                <p>{error ?? "This post could not be found."}</p>
              </div>
            ) : (
              <>
                <header className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                    {post.author.profile_image_url ? (
                      <Image
                        src={post.author.profile_image_url}
                        alt={post.author.username || post.author.email}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-semibold text-gray-600">
                        {(post.author.username ||
                          post.author.email)?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {post.author.username ||
                        `${post.author.first_name} ${post.author.last_name}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                </header>

                <p className="whitespace-pre-line text-sm text-gray-800 sm:text-base">
                  {post.content}
                </p>

                {post.media && post.media.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                    <Image
                      src={post.media[0]}
                      alt="Post media"
                      width={1024}
                      height={512}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                )}

                <footer className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z"
                          fill="currentColor"
                        />
                      </svg>
                      {reactionSummary.total}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 0117 0z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {post.comments?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {Object.entries(reactionSummary.byType)
                      .filter(([, value]) => value > 0)
                      .map(([type, value]) => (
                        <span key={type}>
                          {type}: {value}
                        </span>
                      ))}
                  </div>
                </footer>

                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-gray-800">
                    Comments
                  </h2>
                  {(post.comments ?? []).length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">
                      No comments yet — be the first to share your thoughts.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {(post.comments ?? []).map((comment: Comment) => (
                        <li
                          key={comment.id}
                          className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3"
                        >
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                            {comment.author.profile_image_url ? (
                              <Image
                                src={comment.author.profile_image_url}
                                alt={
                                  comment.author.username ||
                                  comment.author.email
                                }
                                width={36}
                                height={36}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-gray-600">
                                {(
                                  comment.author.username ||
                                  comment.author.email
                                )?.[0]?.toUpperCase() || "U"}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {comment.author.username ||
                                `${comment.author.first_name} ${comment.author.last_name}`}
                            </p>
                            <p className="mt-1 text-sm text-gray-700">
                              {comment.content}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {new Date(comment.created_at).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </section>
    </RequireAuth>
  );
}
