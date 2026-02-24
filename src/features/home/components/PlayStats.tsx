// /src/features/home/components/PlayStats.tsx
import React from 'react';

interface PlayStatsProps {
  playTime: number;
  lastPlayed: string;
}

export const PlayStats: React.FC<PlayStatsProps> = ({ playTime, lastPlayed }) => {
  return (
    <div className="absolute left-8 bottom-12 flex flex-col space-y-1">
      <span className="text-ore-text-muted text-sm font-bold uppercase tracking-wider">
        Play Time
      </span>
      <span className="text-2xl font-minecraft">{playTime} H</span>
      
      <span className="text-ore-text-muted text-sm font-bold uppercase tracking-wider mt-4">
        Last Played
      </span>
      <span className="text-lg font-minecraft">{lastPlayed}</span>
    </div>
  );
};