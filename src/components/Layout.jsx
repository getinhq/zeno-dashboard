import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ProjectStatusBanner } from './ProjectStatusBanner';

export function Layout() {
  useKeyboardShortcuts();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const onShow = () => setShowShortcuts(true);
    const onClose = () => setShowShortcuts(false);
    window.addEventListener('zeno-show-shortcuts', onShow);
    window.addEventListener('zeno-close-shortcuts', onClose);
    return () => {
      window.removeEventListener('zeno-show-shortcuts', onShow);
      window.removeEventListener('zeno-close-shortcuts', onClose);
    };
  }, []);

  return (
    <div className="dashboard-app flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Keyboard shortcuts">
          <div className="bg-background/95 inset-0 absolute" onClick={() => setShowShortcuts(false)} aria-hidden />
          <div className="relative glass-panel p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-serif font-semibold text-foreground mb-3">Keyboard shortcuts</h2>
            <ul className="space-y-2 text-sm text-muted">
              <li><kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">?</kbd> Show this help</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">Esc</kbd> Close modal / go back</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">g</kbd> then <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">d</kbd> Dashboard</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">g</kbd> then <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">t</kbd> Tasks</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">g</kbd> then <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">e</kbd> Entities</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">g</kbd> then <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground">r</kbd> Reviews</li>
            </ul>
            <p className="mt-4 text-muted text-xs">Press Esc or click outside to close.</p>
          </div>
        </div>
      )}
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <ProjectStatusBanner />
        <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
