import { cn } from '@/lib/utils';
import { Stop, StopStatus, BusStatus } from '@/types/student';
import { StopIndicator } from './StopIndicator';
import { StatusBadge } from './ui/StatusBadge';
import { Star, Clock } from 'lucide-react';

interface StopCardProps {
  stop: Stop;
  status: StopStatus;
  isStudentStop: boolean;
  isLast: boolean;
  /** When bus is not started, show "Bus Not Started" instead of "Pending" for pending stops */
  busStatus?: BusStatus;
}

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  status,
  isStudentStop,
  isLast,
  busStatus,
}) => {
  const badgeLabel =
    status === 'pending' && busStatus === 'not-started' ? 'Bus Not Started' : undefined;

  return (
    <div
      className={cn(
        'flex items-start gap-4 animate-fade-in',
        isStudentStop && 'relative'
      )}
    >
      <StopIndicator status={status} isStudentStop={isStudentStop} isLast={isLast} />
      
      <div
        className={cn(
          'flex-1 pb-6',
          isLast && 'pb-0'
        )}
      >
        <div
          className={cn(
            'rounded-lg p-4 transition-all duration-300',
            isStudentStop
              ? 'bg-primary/10 border-2 border-primary shadow-card'
              : status === 'current'
              ? 'bg-accent/10 border border-accent/30'
              : status === 'reached'
              ? 'bg-success/5 border border-success/20'
              : 'bg-card border border-border'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    'font-semibold text-base',
                    status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  {stop.name}
                </h3>
                {isStudentStop && (
                  <Star className="w-4 h-4 text-primary fill-primary" />
                )}
              </div>
              
              {stop.estimatedTime && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {stop.estimatedTime}
                  </span>
                </div>
              )}
            </div>
            
            <StatusBadge status={status} label={badgeLabel} />
          </div>
          
          {isStudentStop && (
            <p className="text-xs text-primary font-medium mt-2">
              Your stop
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
