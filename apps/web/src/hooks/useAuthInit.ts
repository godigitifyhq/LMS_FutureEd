"use client";

import { useEffect } from "react";
import type { Role } from "@lms/types";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";

// Called once on app mount
// Attempts to restore session using httpOnly cookie
export function useAuthInit(): { isLoading: boolean } {
  const { setAuth, clearAuth, isLoading } = useAuthStore();

  useEffect(() => {
    async function restoreSession() {
      try {
        // Try to get a new access token using the refresh cookie
        const { data } = await api.post<{
          data: {
            accessToken: string;
            user: {
              id: string;
              name: string;
              email: string;
              role: Role;
              branchId: string;
              branch?: { name: string; city?: string };
            };
          };
        }>("/auth/refresh");

        const { accessToken, user } = data.data;

        setAuth(
          {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            branchId: user.branchId,
            ...(user.branch ? { branch: user.branch } : {}),
          },
          accessToken,
        );
        document.cookie = "auth_session=1; path=/; max-age=604800; SameSite=Lax";
      } catch {
        clearAuth();
      }
    }

    void restoreSession();
  }, [setAuth, clearAuth]);

  return { isLoading };
}
