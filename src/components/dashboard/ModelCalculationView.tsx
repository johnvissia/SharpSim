import { ModelPredictionCard } from '@/components/dashboard/ModelPredictionCard';
import { Game } from '@/lib/types';

export function ModelCalculationView({ game }: { game: Game }) {
    return (
        <div className="p-4">
            <ModelPredictionCard game={game} compact={false} />
        </div>
    );
}
