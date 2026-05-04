import { BarChart3, LogOut, Moon, Sun, Target, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const items = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/jogadores", label: "Jogadores", icon: Users },
  { to: "/ranking-gols", label: "Ranking Gols", icon: Target },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("so_os_de_fe_theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("so_os_de_fe_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
        <aside className="panel h-fit w-full p-5 lg:sticky lg:top-6 lg:w-72">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-700">Grupo de Futsal</p>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-ink">Só os de Fé</h1>
          </div>

          {user?.tipo === "administrador" ? (
            <div className="mb-6 rounded-3xl bg-ink p-4 text-white">
              <p className="text-sm opacity-70">Patrick Alcides</p>
              <p className="mt-2 text-lg font-bold uppercase">{user?.tipo}</p>
            </div>
          ) : null}

          <nav className="space-y-2">
            {items.map(({ to, label, playerLabel, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition ${
                    isActive ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={18} />
                <span>{user?.tipo === "jogador" && playerLabel ? playerLabel : label}</span>
              </NavLink>
            ))}
          </nav>

          <button onClick={logout} className="button-secondary mt-6 w-full gap-2">
            <LogOut size={18} />
            Sair
          </button>

          <button onClick={toggleTheme} className="button-secondary mt-3 w-full gap-2">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Claro" : "Dark"}
          </button>
        </aside>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
