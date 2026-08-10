"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/auth";

const UserContext = createContext<SessionUser | null>(null);

export const UserProvider = UserContext.Provider;

export function useSessionUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("UserProvider no está disponible.");
  return user;
}

/**
 * Build the full Tapback Memoji URL from a seed.
 * If seed is null/undefined, generates a deterministic fallback from userId.
 */
export function getAvatarUrl(
  seed: string | null | undefined,
  userId: string
): string {
  const effectiveSeed =
    seed || `avatar-${String(deterministicIndex(userId)).padStart(3, "0")}`;
  return `https://tapback.co/api/avatar/${encodeURIComponent(effectiveSeed)}.webp`;
}

/** Simple deterministic hash → number between 1-100 for fallback seed */
function deterministicIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 100) + 1;
}

/** Convenience hook: returns the current user's avatar URL */
export function useAvatarUrl(): string {
  const user = useSessionUser();
  return getAvatarUrl(user.avatarSeed, user.id);
}
