'use client';

import type { Game } from '@/lib/types';
import { ShieldAlert } from 'lucide-react';

export function PlayerPropsView({ game }: { game: Game }) {
    return (
        <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
            <ShieldAlert className="h-10 w-10 text-accent" />
            <p className="font-semibold">Player Props Data Unavailable</p>
            <p className="text-sm">This feature is currently being updated. Please check back later.</p>
        </div>
    );
}
