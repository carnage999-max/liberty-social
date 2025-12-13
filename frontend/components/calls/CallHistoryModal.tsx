"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Video, X } from "lucide-react";
import Image from "next/image";
import { resolveRemoteUrl, DEFAULT_AVATAR } from "@/lib/api";

interface Call {
  id: number;
  caller: { id: string; username: string; first_name?: string; last_name?: string; profile_image_url?: string };
  receiver: { id: string; username: string; first_name?: string; last_name?: string; profile_image_url?: string };
  call_type: "voice" | "video";
  status: string;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
}

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherUserId?: string; // If provided, show calls with this user only
  otherUserName?: string;
}

export default function CallHistoryModal({ isOpen, onClose, otherUserId, otherUserName }: CallHistoryModalProps) {
  const { accessToken, user } = useAuth();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupedCalls, setGroupedCalls] = useState<{ [key: string]: Call[] }>({});

  useEffect(() => {
    if (!isOpen || !accessToken) return;

    const loadCalls = async () => {
      setLoading(true);
      try {
        let url = "/calls/?ordering=-started_at";
        if (otherUserId) {
          // Filter calls with specific user
          url += `&user_id=${otherUserId}`;
        }
        const response = await apiGet<{ results: Call[] }>(url, {
          token: accessToken,
          cache: "no-store",
        });
        setCalls(response.results || []);
      } catch (error) {
        console.error("Failed to load call history:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCalls();
  }, [isOpen, accessToken, otherUserId]);

  // Group calls by date
  useEffect(() => {
    const grouped: { [key: string]: Call[] } = {};
    calls.forEach((call) => {
      const date = new Date(call.started_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey: string;
      if (date.toDateString() === today.toDateString()) {
        dateKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = "Yesterday";
      } else {
        dateKey = date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(call);
    });
    setGroupedCalls(grouped);
  }, [calls]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "Not connected";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCallIcon = (call: Call) => {
    const isCaller = call.caller.id === user?.id?.toString();
    const CallIcon = call.call_type === "video" ? Video : Phone;
    const isAnswered = !!call.answered_at;

    if (!isAnswered && !isCaller) {
      // Missed incoming call
      return <PhoneOff className="w-4 h-4 text-red-500" />;
    } else if (isCaller) {
      // Outgoing call
      return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
    } else {
      // Incoming call
      return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
    }
  };

  const getCallStatus = (call: Call): string => {
    const isCaller = call.caller.id === user?.id?.toString();
    const isAnswered = !!call.answered_at;

    if (!isAnswered && !isCaller) {
      return "Missed";
    } else if (!isAnswered && isCaller) {
      return "Cancelled";
    } else if (call.status === "rejected") {
      return "Declined";
    } else if (isAnswered) {
      return formatDuration(call.duration_seconds);
    }
    return call.status;
  };

  const getOtherUser = (call: Call) => {
    return call.caller.id === user?.id?.toString() ? call.receiver : call.caller;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">
            {otherUserName ? `Call History with ${otherUserName}` : "Call History"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-2 rounded-lg hover:bg-gray-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No call history</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCalls).map(([date, dateCalls]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm py-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                      {date}
                    </h3>
                  </div>

                  {/* Calls for this date */}
                  <div className="space-y-2">
                    {dateCalls.map((call) => {
                      const otherUser = getOtherUser(call);
                      const avatar = otherUser.profile_image_url
                        ? resolveRemoteUrl(otherUser.profile_image_url)
                        : DEFAULT_AVATAR;
                      const name = otherUser.first_name && otherUser.last_name
                        ? `${otherUser.first_name} ${otherUser.last_name}`
                        : otherUser.username;

                      return (
                        <div
                          key={call.id}
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800/50 transition"
                        >
                          {/* Avatar */}
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image
                              src={avatar || DEFAULT_AVATAR}
                              alt={name}
                              fill
                              className="object-cover rounded-full"
                            />
                          </div>

                          {/* Call Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getCallIcon(call)}
                              <span className="text-white font-medium truncate">{name}</span>
                            </div>
                            <div className="text-sm text-gray-400 flex items-center gap-2">
                              <span>{formatTime(call.started_at)}</span>
                              <span>•</span>
                              <span>{getCallStatus(call)}</span>
                            </div>
                          </div>

                          {/* Call Type Badge */}
                          {call.call_type === "video" && (
                            <div className="flex-shrink-0">
                              <Video className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
