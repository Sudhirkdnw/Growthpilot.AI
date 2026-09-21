import React, { useState } from 'react';
import { Lock, User, KeyRound, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeEngine';

export function LoginView() {
  const login = useAuthStore((s) => s.login);
  const settings = useAuthStore((s) => s.settings);
  const { appName, logoUrl } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await login({ username, password });
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-background text-foreground flex items-center justify-center p-6 selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain mx-auto rounded-xl shadow-accent" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center font-bold text-xl shadow-lg shadow-accent mx-auto">
              RS
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {appName || settings?.company?.shopName || 'RS Inventory – Solo'}
          </h1>
          <p className="text-xs text-foreground-muted">Offline-First Point of Sale & Inventory System</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-danger-bg border border-danger-border text-danger-text text-xs flex items-center space-x-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                placeholder="Enter cashier/admin username"
                className="w-full bg-input border border-input-border rounded-xl px-4 py-3 pl-10 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <User className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-input border border-input-border rounded-xl px-4 py-3 pl-10 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <KeyRound className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-accent-foreground font-bold py-3.5 rounded-xl text-sm shadow-accent flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Station</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800/80 text-center flex items-center justify-center space-x-1 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local SQLite database protected with bcrypt hash security</span>
        </div>
      </div>
    </div>
  );
}
