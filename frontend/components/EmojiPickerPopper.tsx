"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiPicker } from "@/components/EmojiPicker";

interface EmojiPickerPopperProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | HTMLButtonElement | null>;
  open: boolean;
}

export function EmojiPickerPopper({
  onSelect,
  onClose,
  triggerRef,
  open,
}: EmojiPickerPopperProps) {
  const popperRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    maxWidth: string;
  }>({ top: 0, left: 0, maxWidth: "300px" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Default picker width and height
      const pickerWidth = 320;
      const pickerHeight = 350;
      
      // Calculate available space
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = viewportWidth - triggerRect.right;

      let top = 0;
      let left = 0;

      // Position vertically: prefer above, fallback to below
      if (spaceAbove > pickerHeight + 10) {
        top = triggerRect.top - pickerHeight - 10;
      } else if (spaceBelow > pickerHeight + 10) {
        top = triggerRect.bottom + 10;
      } else {
        // Center vertically if not enough space
        top = Math.max(
          10,
          Math.min(
            triggerRect.top + triggerRect.height / 2 - pickerHeight / 2,
            viewportHeight - pickerHeight - 10
          )
        );
      }

      // Position horizontally: prefer right-aligned with trigger, fallback to left
      if (spaceRight >= pickerWidth) {
        left = triggerRect.right - pickerWidth;
      } else if (spaceLeft >= pickerWidth) {
        left = triggerRect.left;
      } else {
        // Center horizontally if not enough space
        left = Math.max(10, Math.min(triggerRect.left + triggerRect.width / 2 - pickerWidth / 2, viewportWidth - pickerWidth - 10));
      }

      const maxWidth = Math.max(150, Math.min(pickerWidth, viewportWidth - 20));

      setPosition({
        top,
        left,
        maxWidth: `${maxWidth}px`,
      });
    };

    // Update position when opened
    updatePosition();

    // Update position on scroll or resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, triggerRef]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={popperRef}
      className="fixed z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: position.maxWidth,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <EmojiPicker
        onSelect={handleSelect}
        onClose={onClose}
      />
    </div>,
    document.body
  );
}
