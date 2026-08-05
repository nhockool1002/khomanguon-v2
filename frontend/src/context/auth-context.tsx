"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, setAccessToken, tryRefresh } from "@/lib/api";
import type { AuthResponse, AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    recaptchaToken?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const profile = await apiFetch<AuthUser>("/users/me");
    setUser(profile);
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await tryRefresh();
      if (ok) {
        try {
          await refreshUser();
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string, recaptchaToken?: string) => {
      const res = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, recaptchaToken }),
      });
      setAccessToken(res.accessToken);
      // /auth/login trả về PublicUser rút gọn (không có permissionKeys) — gọi thêm /users/me
      // để UI ngay sau khi đăng nhập đã biết quyền (vd nút Quản trị/Xoá cache ở trang Tài khoản).
      await refreshUser();
    },
    [refreshUser],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      recaptchaToken?: string,
    ) => {
      const res = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName, recaptchaToken }),
      });
      setAccessToken(res.accessToken);
      await refreshUser();
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng trong <AuthProvider>");
  return ctx;
}
