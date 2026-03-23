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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 flex z-40">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${
              isActive ? 'text-primary-400' : 'text-gray-400'
            }`
          }
        >
          <item.icon size={20} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
