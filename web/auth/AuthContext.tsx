import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { localBackend, type AuthBackend, type User } from "./backend";

interface AuthState {
  backend: AuthBackend;
  user: User | null;
  /** False until the stored session has been read. */
  ready: boolean;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthState | null>(null);

/** Swap `localBackend` for a real backend here when accounts go live. */
export function AuthProvider({ children, backend = localBackend }: { children: ReactNode; backend?: AuthBackend }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    backend.current().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, [backend]);
  return <Ctx.Provider value={{ backend, user, ready, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
