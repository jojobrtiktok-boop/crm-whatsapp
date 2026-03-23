import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, MessageCircle, Smartphone, Settings } from 'lucide-react';

const items = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Leads', icon: Users },
  { path: '/atendimento', label: 'Atendimento', icon: MessageCircle },
  { path: '/chips', label: 'Chips', icon: Smartphone },
  { path: '/configuracoes', label: 'Config', icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 flex z-40"
      style={{ background: 'rgba(8,15,31,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid #1a2d4a' }}>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] transition-all"
          style={({ isActive }) => isActive
            ? { color: '#818cf8', filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.8))' }
            : { color: '#3d5270' }}
        >
          <item.icon size={20} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
