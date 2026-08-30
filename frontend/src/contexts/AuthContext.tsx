"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import type { Role } from "@/lib/constants";

export type { User };

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, jwt: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isInitialized: boolean;
  hasRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Load from localStorage on mount
    const storedUser = localStorage.getItem("mentor_sync_user");
    const storedToken = localStorage.getItem("mentor_sync_token");
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    setIsInitialized(true);
  }, []);

  const hasRole = (role: Role): boolean => {
    if (!user) return false;
    return user.roles?.includes(role) ?? false;
  };

  const login = (userData: User, jwt: string) => {
    setUser(userData);
    setToken(jwt);
    localStorage.setItem("mentor_sync_user", JSON.stringify(userData));
    localStorage.setItem("mentor_sync_token", jwt);

    // Redirect based on highest privilege role
    const roles = userData.roles ?? [];
    if (roles.includes("admin")) {
      router.push("/admin/users");
    } else if (roles.includes("mentor")) {
      router.push("/dashboard");
    } else {
      router.push("/my-dashboard");
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("mentor_sync_user");
    localStorage.removeItem("mentor_sync_token");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user, isInitialized, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
