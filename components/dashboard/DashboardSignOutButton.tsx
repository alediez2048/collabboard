'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

export function DashboardSignOutButton(): ReactElement {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      router.push('/login');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isLoading}
        data-testid="dashboard-sign-out"
        className="nb-btn w-full px-3 py-2 text-left text-sm font-bold text-black bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Signing out...' : 'Sign out'}
      </button>
      {errorMessage && (
        <p role="alert" className="text-xs font-bold text-black">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
