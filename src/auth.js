import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { setToken } from "./api";

const KEY_T = "wingman_token";
const KEY_E = "wingman_email";
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(null);
  const [email, setEmail] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(KEY_T);
        const e = await SecureStore.getItemAsync(KEY_E);
        if (t) { setToken(t); setTok(t); setEmail(e); }
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  const signIn = async (t, e) => {
    setToken(t); setTok(t); setEmail(e);
    try { await SecureStore.setItemAsync(KEY_T, t); if (e) await SecureStore.setItemAsync(KEY_E, e); } catch (err) {}
  };
  const signOut = async () => {
    setToken(null); setTok(null); setEmail(null);
    try { await SecureStore.deleteItemAsync(KEY_T); await SecureStore.deleteItemAsync(KEY_E); } catch (e) {}
  };

  return <AuthCtx.Provider value={{ token, email, ready, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
