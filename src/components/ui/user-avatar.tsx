"use client";

import { useState } from "react";
import { getAvatarUrl } from "@/components/layout/user-context";

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80
} as const;

type AvatarSize = keyof typeof sizeMap;

export function UserAvatar({
  seed,
  userId,
  name,
  size = "md",
  className = ""
}: {
  seed: string | null | undefined;
  userId: string;
  name: string;
  size?: AvatarSize;
  className?: string;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const url = getAvatarUrl(seed, userId);
  const px = sizeMap[size];

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const fontSize = Math.max(9, Math.round(px * 0.32));

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Skeleton / Fallback */}
      {status !== "loaded" && (
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full ${
            status === "loading"
              ? "animate-pulse bg-[var(--color-border)]"
              : "bg-[var(--color-primary-soft)] text-[var(--color-accent)]"
          }`}
          style={{ fontSize }}
        >
          {status === "error" && (
            <span className="font-bold leading-none">{initials}</span>
          )}
        </span>
      )}

      {/* Actual image */}
      <img
        src={url}
        alt={`Avatar de ${name}`}
        width={px}
        height={px}
        className={`rounded-full object-cover transition-opacity duration-200 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        draggable={false}
      />
    </span>
  );
}
