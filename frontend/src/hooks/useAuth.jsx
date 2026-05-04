import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const current = await apiFetch("/auth/me");
    setUser(current);
    return current;
  }

  useEffect(() => {
    const token = localStorage.getItem("so_os_de_fe_token");
    if (!token) {
      setLoading(false);
      return;
    }

    refreshUser()
      .catch(() => {
        localStorage.removeItem("so_os_de_fe_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(telefone, senha) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ telefone, senha }),
    });
    localStorage.setItem("so_os_de_fe_token", data.access_token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("so_os_de_fe_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
