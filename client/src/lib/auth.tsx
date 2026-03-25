import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Agent } from "@shared/schema";
import { apiRequest } from "./queryClient";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
const GOOGLE_CLIENT_ID = "19615734221-469n6ahpnd9oocr1en0jo9s737l1f8eo.apps.googleusercontent.com";

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  agents: Agent[];
  loading: boolean;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAdmin: false,
  agents: [],
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsAdmin(data.isAdmin);
        setAgents(data.agents);
      }
    } catch (e) {
      // Not authenticated
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (credential: string) => {
    const res = await apiRequest("POST", "/api/auth/google", { credential });
    const data = await res.json();
    setUser(data.user);
    setIsAdmin(data.isAdmin);
    setAgents(data.agents);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
    setIsAdmin(false);
    setAgents([]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, agents, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { GOOGLE_CLIENT_ID };
