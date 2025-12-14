"use client";

import { useRef, useEffect, useState } from "react";
import { PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";
import Image from "next/image";
import { DEFAULT_AVATAR } from "@/lib/api";
import type { BackgroundType } from "@/hooks/useFeedBackground";

interface ActiveCallModalProps {
  call: any;
  otherUser: {
    id: string;
    username: string;
    avatar?: string;
  };
  onEndCall: () => void;
  isVideoCall: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  endCall: () => Promise<void>;
  chatBackground?: BackgroundType;
  onCallEnded?: (durationSeconds: number) => void;
}

export default function ActiveCallModal({
  call,
  otherUser,
  onEndCall,
  isVideoCall,
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  endCall,
  chatBackground = "default",
  onCallEnded,
}: ActiveCallModalProps) {

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [callDuration, setCallDuration] = useState(0);
  const callStartTimeRef = useRef<number>(Date.now());

  // Ensure local video stream is connected when available
  useEffect(() => {
    if (isVideoCall && localStream && localVideoRef.current) {
      console.log("[ActiveCallModal] Setting local video stream");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => {
        console.error("[ActiveCallModal] Error playing local video:", err);
      });
    }
  }, [localStream, isVideoCall, localVideoRef]);

  // Ensure remote video stream is connected when available
  useEffect(() => {
    if (isVideoCall && remoteStream && remoteVideoRef.current) {
      console.log("[ActiveCallModal] Setting remote video stream");
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.error("[ActiveCallModal] Error playing remote video:", err);
      });
    }
  }, [remoteStream, isVideoCall, remoteVideoRef]);

  // Call duration counter
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format call duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const handleEndCall = async () => {
    const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    await endCall();
    onEndCall();
    // Notify parent with call duration
    if (onCallEnded) {
      onCallEnded(duration);
    }
  };

  // Background helper functions (same as chat page)
  const getBackgroundColors = (): [string, string, string] => {
    switch (chatBackground) {
      case "clouds":
        return ["#E3F2FD", "#BBDEFB", "#90CAF9"];
      case "nature":
        return ["#F1F8E9", "#DCEDC8", "#C5E1A5"];
      case "space":
        return ["#1A1A2E", "#0F3460", "#16213E"];
      case "ocean":
        return ["#006994", "#0085C7", "#00A8E8"];
      case "forest":
        return ["#2D4A2B", "#3F5F3D", "#567D4F"];
      case "stars":
        return ["#0F0F23", "#1A1A3E", "#252550"];
      default:
        return ["#1F2937", "#111827", "#0F172A"];
    }
  };

  const hasAnimatedBackground = [
    "american",
    "christmas",
    "halloween",
    "clouds",
    "nature",
    "space",
    "ocean",
    "forest",
    "stars",
    "butterflies",
    "dragons",
    "christmas-trees",
    "music-notes",
    "pixel-hearts",
  ].includes(chatBackground);

  const isImageBackground = typeof chatBackground === "string" &&
    (chatBackground.startsWith("/backgrounds/") || chatBackground.startsWith("http"));

  const getBackgroundClass = (): string => {
    if (isImageBackground) return "";
    if (chatBackground === "default") return "";
    const themeMap: Record<string, string> = {
      american: "feed-bg-american",
      christmas: "feed-bg-christmas",
      halloween: "feed-bg-halloween",
      clouds: "feed-bg-clouds",
      nature: "feed-bg-nature",
      space: "feed-bg-space",
      ocean: "feed-bg-ocean",
      forest: "feed-bg-forest",
      stars: "feed-bg-stars",
      butterflies: "feed-bg-butterflies",
      dragons: "feed-bg-dragons",
      "christmas-trees": "feed-bg-christmas-trees",
      "music-notes": "feed-bg-music-notes",
      "pixel-hearts": "feed-bg-pixel-hearts",
    };
    return themeMap[chatBackground] || "";
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${!isVideoCall ? getBackgroundClass() : ""}`}
      style={{
        backgroundColor: !isVideoCall && chatBackground !== "default" && !hasAnimatedBackground && !isImageBackground ? "transparent" : "#000000",
        backgroundImage: !isVideoCall && isImageBackground ? `url(${chatBackground})` : undefined,
        backgroundSize: !isVideoCall && isImageBackground ? "cover" : undefined,
        backgroundPosition: !isVideoCall && isImageBackground ? "center" : undefined,
        backgroundRepeat: !isVideoCall && isImageBackground ? "no-repeat" : undefined,
      }}
    >
      {/* Background gradient layer for voice calls with non-animated themes */}
      {!isVideoCall && !hasAnimatedBackground && !isImageBackground && chatBackground !== "default" && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(135deg, ${getBackgroundColors().join(", ")})`,
          }}
        />
      )}

      {/* Dark overlay for voice calls with backgrounds */}
      {!isVideoCall && chatBackground !== "default" && (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 50%, rgba(0, 0, 0, 0.5) 100%)",
          }}
        />
      )}

      {/* Remote video (full screen) */}
      {isVideoCall && (
        <div className="absolute inset-0">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Local video (picture-in-picture) */}
      {isVideoCall && (
        <div className="absolute top-4 right-4 w-32 h-48 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Call info overlay (for voice calls) */}
      {!isVideoCall && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white relative z-10">
            {/* Avatar */}
            <div className="relative w-32 h-32 rounded-full mx-auto mb-6 border-4 border-white/20 shadow-2xl overflow-hidden">
              <Image
                src={otherUser.avatar || DEFAULT_AVATAR}
                alt={otherUser.username}
                fill
                className="object-cover"
              />
            </div>

            {/* User info */}
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">{otherUser.username}</h2>
            <p className="text-gray-200 text-lg mb-4 drop-shadow-md">Voice Call</p>

            {/* Call duration */}
            <div className="text-2xl font-mono text-white/90 drop-shadow-md">
              {formatDuration(callDuration)}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isMuted
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-700/80 hover:bg-gray-600/80"
          } text-white`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {isVideoCall && (
          <button
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isVideoEnabled
                ? "bg-gray-700/80 hover:bg-gray-600/80"
                : "bg-red-500 hover:bg-red-600"
            } text-white`}
          >
            {isVideoEnabled ? (
              <Video className="w-6 h-6" />
            ) : (
              <VideoOff className="w-6 h-6" />
            )}
          </button>
        )}

        <button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

