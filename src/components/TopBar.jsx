import { useState, useRef, useEffect } from 'react';
import { User, LogOut } from 'lucide-react';
import { ProjectSelector } from './ProjectSelector';
import { NotificationsButton } from './NotificationsButton';
import { useAuth } from '../contexts/AuthContext';

export function TopBar() {
  const { user, logout, enabled } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10 w-full shrink-0">
      <div className="flex items-center gap-6">
        <ProjectSelector />
      </div>
      <div className="flex items-center gap-3">
        <NotificationsButton />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="h-8 flex items-center gap-2 rounded-full border border-border px-2 hover:border-primary transition-colors"
            title={user?.username || 'Account'}
          >
            <span className="h-6 w-6 rounded-full bg-border flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-muted" />
            </span>
            <span className="hidden md:inline text-xs font-medium text-foreground max-w-[120px] truncate">
              {user?.username || 'account'}
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-card shadow-xl z-50">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.name || user?.username || 'Unknown'}
                </p>
                <p className="text-xs text-muted truncate">{user?.email || user?.username}</p>
                {user?.app_role && (
                  <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-primary border border-primary/40 rounded px-1.5 py-0.5">
                    {user.app_role}
                  </span>
                )}
              </div>
              {enabled && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-card-hover flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
