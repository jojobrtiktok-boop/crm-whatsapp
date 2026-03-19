import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Smartphone,
  GitBranch,
  MessageCircle,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'CRM / Leads', icon: Users },
  { path: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { path: '/chips', label: 'Chips', icon: Smartphone },
  { path: '/funis', label: 'Funis', icon: GitBranch },
  { path: '/atendimento', label: 'Atendimento', icon: MessageCircle },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar() {
  const { logout, usuario } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col z-30">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-xl font-bold text-primary-400">CRM WhatsApp</h1>
        <p className="text-xs text-gray-400 mt-1">Automação + IA</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-400'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuário */}
      <div className="border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{usuario?.nome}</p>
            <p className="text-xs text-gray-400">{usuario?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
