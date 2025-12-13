"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { resolveRemoteUrl, DEFAULT_AVATAR } from "@/lib/api";

interface IncomingCallModalProps {
  call: {
    id: string;
    caller_id: string;
    caller_username: string;
    call_type: "voice" | "video";
  };
  onAccept: () => void;
  onReject: () => void;
  callerAvatar?: string;
}

export default function IncomingCallModal({
  call,
  onAccept,
  onReject,
  callerAvatar,
}: IncomingCallModalProps) {
  const { user } = useAuth();

  // Auto-reject after 30 seconds if not answered
  useEffect(() => {
    const timer = setTimeout(() => {
      onReject();
    }, 30000);

    return () => clearTimeout(timer);
  }, [onReject]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-6">
            <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden ring-4 ring-primary/20">
              <Image
                src={resolveRemoteUrl(callerAvatar) || DEFAULT_AVATAR}
                alt={call.caller_username}
                fill
                className="object-cover"
              />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Incoming {call.call_type === "video" ? "Video" : "Voice"} Call
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            {call.caller_username}
          </p>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={onReject}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            <button
              onClick={onAccept}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
            >
              {call.call_type === "video" ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

