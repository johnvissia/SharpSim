import { GameFeed } from '@/components/dashboard/game-feed';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Today's Games
        </h1>
        <p className="text-muted-foreground">
          Your daily feed of sporting events. Star your favorites to see them here.
        </p>
      </header>

      <GameFeed />
    </div>
  );
}
