"use client";

import { useRef, useEffect, useState } from "react";
import { PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";

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
}: ActiveCallModalProps) {

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);

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
    await endCall();
    onEndCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
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
          <div className="text-center text-white">
            <div className="w-24 h-24 rounded-full bg-gray-700 mb-4 mx-auto flex items-center justify-center">
              <span className="text-3xl font-bold">
                {otherUser.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-2">{otherUser.username}</h2>
            <p className="text-gray-300">Voice Call</p>
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

