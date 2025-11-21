import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const API = getApiUrl();

  const saveToken = (t) => {
    setToken(t);
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  };

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        saveToken(null);
        setUser(null);
      } else {
        const json = await res.json();
        setUser(json.user ?? null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      throw new Error(json.message || "Login failed");
    }
    if (json.token) {
      saveToken(json.token);
      setUser(json.user ?? null);
    }
    setLoading(false);
  };

  const register = async (data, file) => {
    setLoading(true);
    let res;
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, String(v)));
      fd.append("doctorDocument", file);
      res = await fetch(`${API}/api/auth/register`, { method: "POST", body: fd });
    } else {
      res = await fetch(`${API}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      throw new Error(json.message || "Registration failed");
    }
    if (json.token) {
      saveToken(json.token);
      setUser(json.user ?? null);
    }
    setLoading(false);
  };

  const logout = () => {
    saveToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
