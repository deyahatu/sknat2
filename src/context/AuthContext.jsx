import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

// Auto-logout after this many minutes of no user activity. Matches the
// "session timeout" convention students recognise from university portals
// (e.g. Zajel) and protects shared lab/library computers.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idleLogout, setIdleLogout] = useState(false);

  useEffect(() => {
    api.auth.me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.auth.login({ email, password });
    setUser(data.user);
    setIdleLogout(false);
    return data;
  };

  const register = async ({ name, email, phone, password, role, ...extraFields }) => {
    const data = await api.auth.register({ name, email, phone, password, role, ...extraFields });
    return data;
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await api.auth.me();
      setUser(data.user);
    } catch {
      setUser(null);
    }
  };

  // Idle auto-logout: reset a timer on any user interaction; if no activity
  // for IDLE_TIMEOUT_MS, sign the user out and surface a flag the UI can use
  // to show a toast on the login page.
  const timerRef = useRef(null);
  useEffect(() => {
    if (!user) return undefined;

    const triggerLogout = async () => {
      try {
        await api.auth.logout();
      } catch {
        // ignore — we still want to clear local state
      }
      setUser(null);
      setIdleLogout(true);
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(triggerLogout, IDLE_TIMEOUT_MS);
    };

    resetTimer();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, resetTimer);
      }
    };
  }, [user]);

  const value = { user, loading, login, register, logout, refreshUser, idleLogout, clearIdleLogout: () => setIdleLogout(false) };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
