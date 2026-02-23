'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface NavbarProps {
  user: User | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="bg-white border-b-2 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-black text-black tracking-tight">
              CollabBoard
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm font-bold text-black">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="nb-btn inline-flex items-center px-4 py-2 text-sm font-bold text-black bg-[var(--nb-accent-red)] rounded-lg"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="nb-btn inline-flex items-center px-4 py-2 text-sm font-bold text-black bg-white rounded-lg"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
