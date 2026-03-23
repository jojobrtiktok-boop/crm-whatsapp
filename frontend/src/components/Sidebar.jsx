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
  Zap,
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
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-30"
      style={{ background: 'linear-gradient(180deg, #080f1f 0%, #060b18 100%)', borderRight: '1px solid #1a2d4a' }}>

      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid #1a2d4a' }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', boxShadow: '0 0 14px rgba(99,102,241,0.5)' }}>
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">CRM WhatsApp</h1>
            <p className="text-[10px]" style={{ color: '#475569' }}>Automação + IA</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-0.5 px-3">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? 'text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`
            }
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
              boxShadow: '0 0 16px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
              border: '1px solid rgba(99,102,241,0.25)',
            } : {
              background: 'transparent',
              border: '1px solid transparent',
            }}
          >
            {({ isActive }) => (
              <>
                <item.icon size={17} style={isActive ? { color: '#818cf8', filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.7))' } : {}} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Usuário */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid #1a2d4a' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
              {usuario?.nome?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-xs font-medium text-white">{usuario?.nome}</p>
              <p className="text-[10px]" style={{ color: '#475569' }}>{usuario?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
            style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
