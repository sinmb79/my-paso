"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastProps = {
  message: string | null;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
};

const typeStyles: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: "var(--success-bg)", text: "var(--success)", border: "var(--success)" },
  error: { bg: "var(--error-bg)", text: "var(--error)", border: "var(--error)" },
  info: { bg: "var(--accent-bg)", text: "var(--accent)", border: "var(--accent)" },
};

export function Toast({ message, type = "success", duration = 3000, onDismiss }: ToastProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!message) return;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, duration);

    const dismissTimer = setTimeout(() => {
      setFading(false);
      onDismiss();
    }, duration + 300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
      setFading(false);
    };
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const style = typeStyles[type];

  return (
    <div
      className="fixed left-4 right-4 top-4 z-[60] mx-auto max-w-sm transition-all duration-300"
      style={{
        opacity: fading ? 0 : 1,
        transform: fading ? "translateY(-12px)" : "translateY(0)",
      }}
    >
      <div
        className="rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg"
        style={{
          backgroundColor: style.bg,
          color: style.text,
          borderColor: `color-mix(in srgb, ${style.border} 30%, transparent)`,
        }}
      >
        {message}
      </div>
    </div>
  );
}
