import { Route } from '@/types/student';
import { MapPin, ChevronRight, Bus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({ route, isSelected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all duration-200',
        'hover:shadow-card hover:border-primary/50',
        isSelected
          ? 'bg-primary/10 border-primary shadow-card'
          : 'bg-card border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isSelected ? 'bg-primary' : 'bg-secondary'
            )}
          >
            <Bus className={cn('w-5 h-5', isSelected ? 'text-primary-foreground' : 'text-foreground')} />
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground">{route.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{route.description}</p>
            <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-xs">{route.stops.length} stops</span>
            </div>
          </div>
        </div>
        
        <ChevronRight className={cn(
          'w-5 h-5 transition-colors',
          isSelected ? 'text-primary' : 'text-muted-foreground'
        )} />
      </div>
    </button>
  );
};
