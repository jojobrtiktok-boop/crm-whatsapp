import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Vendas from './pages/Vendas';
import Chips from './pages/Chips';
import Funis from './pages/Funis';
import FunilEditor from './pages/FunilEditor';
import Atendimento from './pages/Atendimento';
import Configuracoes from './pages/Configuracoes';

// Rota protegida - redireciona para login se não autenticado
function RotaProtegida({ children }) {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RotaProtegida>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/vendas" element={<Vendas />} />
                <Route path="/chips" element={<Chips />} />
                <Route path="/funis" element={<Funis />} />
                <Route path="/funis/:id" element={<FunilEditor />} />
                <Route path="/atendimento" element={<Atendimento />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Routes>
            </Layout>
          </RotaProtegida>
        }
      />
    </Routes>
  );
}
