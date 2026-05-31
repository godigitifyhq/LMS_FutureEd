"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { Role } from "@lms/types";

type LoginResponse = {
  success: true;
  data: {
    accessToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      branchId: string;
    };
  };
};

// ── Login mutation ──
export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      // Use same-origin Next.js proxy so the refreshToken cookie is first-party (iOS safe).
      // Override baseURL to "" so axios resolves to the current origin instead of the API domain.
      const { data } = await api.post<LoginResponse>("/api/auth/login", credentials, {
        baseURL: "",
      });
      return data.data;
    },
    onSuccess: (data) => {
      setAuth(
        {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          branchId: data.user.branchId,
        },
        data.accessToken,
      );
      document.cookie = "auth_session=1; path=/; max-age=604800; SameSite=Lax";
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      router.replace("/dashboard");
    },
    onError: () => {
      // Error handling done in the component (attempt tracking)
    },
  });
}

// ── Forgot password mutation ──
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post("/auth/forgot-password", { email });
    },
    onSuccess: () => {
      toast.success("Reset link sent if this email exists");
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });
}

// ── Reset password mutation ──
export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (params: { token: string; newPassword: string }) => {
      await api.post("/auth/reset-password", params);
    },
    onSuccess: () => {
      toast.success("Password updated. Please login.");
      router.replace("/login");
    },
    onError: () => {
      toast.error("Reset link is invalid or expired.");
    },
  });
}

// ── Setup password mutation (new user) ──
export function useSetupPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (params: { token: string; newPassword: string }) => {
      await api.post("/auth/reset-password", params);
    },
    onSuccess: () => {
      toast.success("Password set! Please login with your new credentials.");
      router.replace("/login");
    },
    onError: () => {
      toast.error("Setup link is invalid or expired. Contact your admin.");
    },
  });
}

// ── Logout mutation ──
export function useLogout() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      await api.post("/api/auth/logout", {}, { baseURL: "" });
    },
    onSuccess: () => {
      clearAuth();
      toast.success("Logged out successfully");
      router.replace("/login");
    },
    onError: () => {
      clearAuth();
      router.replace("/login");
    },
  });
}
