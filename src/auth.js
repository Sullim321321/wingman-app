import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { setToken, setOn401Handler, API_BASE } from "./api";

const KEY_T  = "wingman_token";
const KEY_R  = "wingman_refresh"; // rotating refresh token
const KEY_E  = "wingman_email";

function withTimeout(promise, ms = 3000, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const AuthCtx = createContext(null);

function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch { return null; }
}

function secondsUntilExpiry(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return 0;
  return Math.max(0, payload.exp - Date.now() / 1000);
}

function isTokenExpired(token) {
  return secondsUntilExpiry(token) < 60;
}

export function AuthProvider({ children }) {
  const [token, setTok]   = useState(null);
  const [email, setEmail] = useState(null);
  const [ready, setReady] = useState(false);
  const refreshTimerRef   = useRef(null);
  const refreshingRef     = useRef(false);

  const scheduleRefresh = (accessToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const secs = secondsUntilExpiry(accessToken);
    if (secs <= 0) return;
    const delay = Math.max(0, (secs - 60) * 1000);
    refreshTimerRef.current = setTimeout(() => { silentRefresh(); }, delay);
  };

  const silentRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const storedRefresh = await withTimeout(SecureStore.getItemAsync(KEY_R));
      if (!storedRefresh) { await signOut(); return; }
      const resp = await fetch(API_BASE + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      if (!resp.ok) { await signOut(); return; }
      const data = await resp.json();
      if (!data.token || !data.refreshToken) { await signOut(); return; }
      await SecureStore.setItemAsync(KEY_T, data.token);
      await SecureStore.setItemAsync(KEY_R, data.refreshToken);
      setToken(data.token);
      setTok(data.token);
      scheduleRefresh(data.token);
    } catch (e) {
      // Network error — don't sign out, let next API call trigger 401 if needed
    } finally {
      refreshingRef.current = false;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const t = await withTimeout(SecureStore.getItemAsync(KEY_T));
        const r = await withTimeout(SecureStore.getItemAsync(KEY_R));
        const e = await withTimeout(SecureStore.getItemAsync(KEY_E));
        if (t) {
          if (isTokenExpired(t)) {
            if (r) {
              refreshingRef.current = false;
              await silentRefresh();
            } else {
              await SecureStore.deleteItemAsync(KEY_T);
              await SecureStore.deleteItemAsync(KEY_E);
            }
          } else {
            setToken(t);
            setTok(t);
            setEmail(e);
            scheduleRefresh(t);
          }
        }
      } catch (e) {}
      setReady(true);
    })();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

  const signIn = async (t, e, r) => {
    setToken(t);
    setTok(t);
    setEmail(e);
    try {
      await SecureStore.setItemAsync(KEY_T, t);
      if (e) await SecureStore.setItemAsync(KEY_E, e);
      if (r) await SecureStore.setItemAsync(KEY_R, r);
    } catch (err) {}
    scheduleRefresh(t);
  };

  const signOut = async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setToken(null);
    setTok(null);
    setEmail(null);
    try {
      await SecureStore.deleteItemAsync(KEY_T);
      await SecureStore.deleteItemAsync(KEY_R);
      await SecureStore.deleteItemAsync(KEY_E);
    } catch (e) {}
  };

  useEffect(() => {
    setOn401Handler(async () => {
      const storedRefresh = await withTimeout(SecureStore.getItemAsync(KEY_R)).catch(() => null);
      if (storedRefresh) {
        await silentRefresh();
      } else {
        await signOut();
      }
    });
    return () => setOn401Handler(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ token, email, ready, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
