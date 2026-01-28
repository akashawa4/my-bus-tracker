import { Stop } from '@/types/student';
import { MapPin, Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StopSelectCardProps {
  stop: Stop;
  isSelected: boolean;
  onSelect: () => void;
}

export const StopSelectCard: React.FC<StopSelectCardProps> = ({ stop, isSelected, onSelect }) => {
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            )}
          >
            {stop.order}
          </div>
          
          <div>
            <h3 className="font-medium text-foreground">{stop.name}</h3>
            {stop.estimatedTime && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{stop.estimatedTime}</span>
              </div>
            )}
          </div>
        </div>
        
        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>
    </button>
  );
};
