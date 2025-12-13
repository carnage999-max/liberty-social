"use client";

import { useEffect } from "react";
import Image from "next/image";
import { PhoneOff } from "lucide-react";
import { resolveRemoteUrl, DEFAULT_AVATAR } from "@/lib/api";

interface OutgoingCallModalProps {
  call: {
    id?: string | number;
    receiver_id: string;
    receiver_username: string;
    call_type: "voice" | "video";
  };
  onCancel: () => void;
  receiverAvatar?: string;
}

export default function OutgoingCallModal({
  call,
  onCancel,
  receiverAvatar,
}: OutgoingCallModalProps) {
  console.log("[OutgoingCallModal] Rendering modal with call:", call);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-6">
            <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden ring-4 ring-primary/20">
              <Image
                src={resolveRemoteUrl(receiverAvatar) || DEFAULT_AVATAR}
                alt={call.receiver_username}
                fill
                className="object-cover"
              />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Calling {call.receiver_username}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            {call.call_type === "video" ? "Video" : "Voice"} Call
          </p>

          <div className="flex items-center justify-center">
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

