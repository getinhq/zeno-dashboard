export function Settings() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted text-sm tracking-wide mt-1">Global and project configuration</p>
      </div>
      <div className="glass-panel p-6">
        <p className="text-muted text-sm">Global and project settings (from API /settings/global and /settings/project) can be wired here.</p>
      </div>
    </div>
  );
}
