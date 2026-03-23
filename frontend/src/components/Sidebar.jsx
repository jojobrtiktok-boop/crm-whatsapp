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
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-30"
      style={{ background: 'linear-gradient(180deg, #080f1f 0%, #060b18 100%)', borderRight: '1px solid #1a2d4a' }}>

      {/* Logo */}
      <div className="flex items-center px-3 py-3" style={{ borderBottom: '1px solid #1a2d4a' }}>
        <img
          src="https://i.postimg.cc/kMSmpLX7/Chat-GPT-Image-23-de-mar-de-2026-12-02-06.png"
          alt="Logo"
          style={{ height: '56px', width: '100%', maxWidth: '180px', objectFit: 'contain', filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(129,140,248,0.4))' }}
        />
      </div>

      {/* Menu */}
      <nav style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#ffffff' : '#8899aa',
              textDecoration: 'none',
              transition: 'all 0.2s',
              border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              background: isActive
                ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18))'
                : 'transparent',
              boxShadow: isActive ? '0 0 14px rgba(99,102,241,0.18)' : 'none',
            })}
            onMouseEnter={e => { if (!e.currentTarget.style.boxShadow.includes('14px')) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#ccd6e0'; } }}
            onMouseLeave={e => { if (!e.currentTarget.style.boxShadow.includes('14px')) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8899aa'; } }}
          >
            {({ isActive }) => (
              <>
                <item.icon size={17} style={{ color: isActive ? '#818cf8' : '#8899aa', filter: isActive ? 'drop-shadow(0 0 5px rgba(129,140,248,0.6))' : 'none', flexShrink: 0 }} />
                <span>{item.label}</span>
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
