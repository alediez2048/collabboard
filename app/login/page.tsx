'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

function getSafeRedirectPath(nextParam: string | null): string {
  if (!nextParam) return '/';
  if (!nextParam.startsWith('/')) return '/';
  if (nextParam.startsWith('//')) return '/';
  return nextParam;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const redirectPath = getSafeRedirectPath(searchParams.get('next'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data.session) {
          router.push(redirectPath);
          router.refresh();
        } else {
          setMessage('Check your email for a confirmation link, then sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectPath);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--nb-bg)' }}>
      <div className="max-w-md w-full space-y-8 p-8 bg-white border-2 border-black rounded-lg shadow-[6px_6px_0px_#000]">
        <div>
          <h2 className="text-center text-4xl font-black text-black">
            {isSignUp ? 'Create your account' : 'Sign in to CollabBoard'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-black">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="nb-input mt-1 block w-full px-3 py-2 text-black placeholder:text-[var(--nb-text-muted)] caret-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-black">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                className="nb-input mt-1 block w-full px-3 py-2 text-black placeholder:text-[var(--nb-text-muted)] caret-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="border-2 border-black rounded-lg bg-[var(--nb-accent-red)] p-4">
              <p className="text-sm font-bold text-black">{error}</p>
            </div>
          )}

          {message && (
            <div className="border-2 border-black rounded-lg bg-[var(--nb-accent-green)] p-4">
              <p className="text-sm font-bold text-black">{message}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="nb-btn w-full flex justify-center py-3 px-4 text-sm font-bold uppercase text-black bg-[var(--nb-accent-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm font-bold text-black underline underline-offset-2 hover:text-[var(--nb-accent-blue)]"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
