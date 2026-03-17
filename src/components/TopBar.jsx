import { Link } from 'react-router-dom';
import { Bell, Search, Plus, User } from 'lucide-react';
import { ProjectSelector } from './ProjectSelector';

export function TopBar() {
  return (
    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10 w-full shrink-0">
      <div className="flex items-center gap-6">
        <ProjectSelector />
      </div>

      <div className="flex-1 max-w-xl px-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
          <input
            type="search"
            placeholder="Search entities, tasks (Cmd+K)"
            className="w-full bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-full pl-10 pr-4 py-2 transition-colors focus:outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative text-muted hover:text-foreground transition-colors p-2 hover:bg-card-hover rounded-full"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card animate-pulse shadow-[0_0_8px_rgba(212,255,0,0.6)]" />
        </button>
        <Link
          to="/publish"
          className="btn-primary flex items-center gap-2 py-1.5 px-3 text-sm shadow-[0_0_15px_rgba(212,255,0,0.2)]"
        >
          <Plus className="w-4 h-4" />
          Publish
        </Link>
        <div className="h-8 w-8 rounded-full bg-border border border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors ml-2">
          <User className="w-4 h-4 text-muted" />
        </div>
      </div>
    </div>
  );
}
