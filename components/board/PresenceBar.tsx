'use client';

import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import type { AwarenessUser } from '@/types/presence';

interface PresenceBarProps {
  provider: WebsocketProvider;
  currentUserId: string;
}

export function PresenceBar({ provider, currentUserId }: PresenceBarProps) {
  const [onlineUsers, setOnlineUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    const updatePresence = (): void => {
      const states = Array.from(provider.awareness.getStates().values());
      const users = states
        .map((state) => (state as { user?: AwarenessUser }).user)
        .filter((user): user is AwarenessUser => !!user);
      setOnlineUsers(users);
    };

    provider.awareness.on('change', updatePresence);
    updatePresence(); // initial load

    return () => {
      provider.awareness.off('change', updatePresence);
    };
  }, [provider]);

  const MAX_VISIBLE = 5;
  const visibleUsers = onlineUsers.slice(0, MAX_VISIBLE);
  const overflow = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="presence-bar absolute top-16 right-4 z-10 flex items-center gap-2">
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => (
          <div
            key={user.userId}
            title={user.userName}
            style={{ backgroundColor: user.color }}
            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold cursor-default select-none${
              user.userId === currentUserId ? ' ring-2 ring-offset-1 ring-gray-400' : ''
            }`}
          >
            {user.userName[0]?.toUpperCase() ?? '?'}
          </div>
        ))}

        {/* Overflow badge */}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center bg-gray-400 text-white text-xs font-bold cursor-default select-none">
            +{overflow}
          </div>
        )}
      </div>

      {/* Count badge */}
      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
        {onlineUsers.length} online
      </span>
    </div>
  );
}
