import React, { useState } from 'react';
import { Lock, ArrowRight, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function LockScreen() {
  const session = useAuthStore((s) => s.session);
  const unlock = useAuthStore((s) => s.unlock);
  const logout = useAuthStore((s) => s.logout);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);
    const res = await unlock(password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Incorrect password');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-7 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-accent-muted border border-accent/30 flex items-center justify-center mx-auto text-accent">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground">Station Inactive / Locked</h2>
          <p className="text-xs text-foreground-muted mt-1">
            Logged in as <strong className="text-foreground">{session?.user?.fullName || session?.user?.username}</strong>
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger-bg border border-danger-border text-danger-text text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to unlock"
            className="w-full bg-input border border-input-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary text-center"
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground font-bold py-3 rounded-xl text-xs shadow-accent flex items-center justify-center space-x-2 transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Resume Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-foreground-muted hover:text-danger flex items-center justify-center space-x-1 mx-auto transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch Cashier / Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
