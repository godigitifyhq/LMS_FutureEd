import { create } from "zustand";
import { tokenStore } from "@/lib/api";
import api from "@/lib/api";
import type { Role } from "@lms/types";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string;
  branch?: { name: string; city?: string };
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isBootstrapped: boolean;
  isBootstrapping: boolean;
  isAuthenticated: boolean;

  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  bootstrap: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isBootstrapped: false,
  isBootstrapping: false,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    tokenStore.set(accessToken);
    set({ user, isLoading: false, isAuthenticated: true });
  },

  clearAuth: () => {
    tokenStore.clear();
    if (typeof document !== "undefined") {
      document.cookie = "auth_session=; path=/; max-age=0; SameSite=Lax";
    }
    set({ user: null, isLoading: false, isAuthenticated: false });
  },

  bootstrap: async () => {
    if (get().isBootstrapped || get().isBootstrapping) return;
    set({ isLoading: true, isBootstrapping: true });
    try {
      // Call the same-origin Next.js proxy so iOS Safari's ITP never blocks the cookie
      const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
      if (!refreshRes.ok) throw new Error("refresh_failed");
      const refreshData = await refreshRes.json() as { data: { accessToken: string } };
      tokenStore.set(refreshData.data.accessToken);

      // Then get user info
      const { data: meData } = await api.get("/auth/me");
      set({
        user: meData.data,
        isLoading: false,
        isBootstrapped: true,
        isBootstrapping: false,
        isAuthenticated: true,
      });
    } catch {
      get().clearAuth();
      set({ isBootstrapped: true, isBootstrapping: false });
    }
  },
}));
