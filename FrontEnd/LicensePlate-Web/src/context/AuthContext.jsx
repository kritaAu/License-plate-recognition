import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("auth:user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = (username) => {
    const u = { username };
    setUser(u);
    localStorage.setItem("auth:user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("auth:user");
  };

  const value = useMemo(() => ({ user, isAuthenticated: !!user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
