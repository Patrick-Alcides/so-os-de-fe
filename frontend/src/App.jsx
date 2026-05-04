import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./hooks/useAuth";
import DashboardPage from "./pages/DashboardPage";
import GameBuilderPage from "./pages/GameBuilderPage";
import GoalRankingPage from "./pages/GoalRankingPage";
import LoginPage from "./pages/LoginPage";
import PlayersPage from "./pages/PlayersPage";
import VotingsPage from "./pages/VotingsPage";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-lg font-semibold">Carregando...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected />}>
        <Route index element={<DashboardPage />} />
        <Route path="jogadores" element={<PlayersPage />} />
        <Route path="ranking-gols" element={<GoalRankingPage />} />
        <Route path="ranking-gols/:playerId" element={<GoalRankingPage />} />
        <Route path="votacoes" element={<VotingsPage />} />
        <Route path="montar-jogo" element={<GameBuilderPage />} />
      </Route>
    </Routes>
  );
}
