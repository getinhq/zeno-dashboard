import { NavLink } from 'react-router-dom';
import {
  Home,
  FolderTree,
  Compass,
  CheckSquare,
  PlaySquare,
  BarChart3,
  Settings,
  Bug,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessSettings } from '../lib/permissions';

const baseLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/entities', label: 'Entities', icon: FolderTree },
  { to: '/explorer', label: 'Explorer', icon: Compass },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/reviews', label: 'Reviews', icon: PlaySquare },
  { to: '/issues', label: 'Issues', icon: Bug },
  { to: '#', label: 'Reports', icon: BarChart3 },
];

export function Sidebar() {
  const { user } = useAuth();
  const links = canAccessSettings(user)
    ? [...baseLinks, { to: '/settings', label: 'Settings', icon: Settings }]
    : baseLinks;

  return (
    <div className="w-16 md:w-64 bg-card border-r border-border h-full flex flex-col py-6 transition-all duration-300 shrink-0">
      <div className="px-5 mb-8 hidden md:block">
        <h1 className="text-2xl font-serif text-primary tracking-tight">Zeno</h1>
      </div>
      <nav className="flex-1 flex flex-col gap-2 px-3">
        {links.map(({ to, label, icon: Icon }) => {
          if (to === '#') {
            return (
              <span
                key={to + label}
                className="flex flex-row items-center gap-4 px-3 py-2.5 rounded-md text-muted opacity-60 cursor-not-allowed"
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden md:block font-medium text-sm">{label}</span>
              </span>
            );
          }
          return (
            <NavLink
              key={to + label}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive: active }) =>
                `flex flex-row items-center gap-4 px-3 py-2.5 rounded-md transition-all duration-200 group ${active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-card-hover hover:text-foreground'}`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden md:block font-medium text-sm">{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
