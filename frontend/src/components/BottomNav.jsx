import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, MessageCircle, Smartphone, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const items = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Leads', icon: Users },
  { path: '/atendimento', label: 'Atendimento', icon: MessageCircle },
  { path: '/chips', label: 'Chips', icon: Smartphone },
  { path: '/configuracoes', label: 'Config', icon: Settings },
];

export default function BottomNav() {
  const { logout } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 flex z-40"
      style={{
        background: 'rgba(8,15,31,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(129,140,248,0.35)',
        boxShadow: '0 -2px 20px rgba(129,140,248,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className="flex-1 flex flex-col items-center justify-center py-2 text-[10px] transition-all"
          style={{ color: 'transparent' }}
        >
          {({ isActive }) => (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '6px 10px', borderRadius: 14,
              ...(isActive ? {
                color: '#a78bfa',
                background: 'rgba(129,140,248,0.12)',
                border: '1px solid rgba(129,140,248,0.45)',
                boxShadow: '0 0 16px rgba(129,140,248,0.4), inset 0 0 8px rgba(129,140,248,0.08)',
                filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.8))',
              } : {
                color: '#3d5270',
                border: '1px solid transparent',
              }),
            }}>
              <item.icon size={19} />
              <span>{item.label}</span>
            </div>
          )}
        </NavLink>
      ))}

      {/* Botão Sair */}
      <button
        onClick={logout}
        className="flex-1 flex flex-col items-center justify-center py-2 text-[10px] transition-all"
        style={{ color: 'transparent' }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '6px 10px', borderRadius: 14,
          color: '#3d5270', border: '1px solid transparent',
        }}
          onTouchStart={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.border = '1px solid rgba(239,68,68,0.3)'; }}
          onTouchEnd={e => { e.currentTarget.style.color = '#3d5270'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; }}
        >
          <LogOut size={19} />
          <span>Sair</span>
        </div>
      </button>
    </nav>
  );
}
