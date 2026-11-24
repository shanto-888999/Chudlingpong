import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 border border-amber-400/30 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      Offline Mode — Playing locally
    </div>
  );
};
