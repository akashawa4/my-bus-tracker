import { cn } from '@/lib/utils';
import { Stop, StopStatus, BusStatus } from '@/types/student';
import { StopIndicator } from './StopIndicator';
import { StatusBadge } from './ui/StatusBadge';
import { Star, Clock } from 'lucide-react';

/** Format timestamp (ms) to locale time string e.g. "9:44 AM" */
function formatReachedTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface StopCardProps {
  stop: Stop;
  status: StopStatus;
  isStudentStop: boolean;
  isLast: boolean;
  /** When bus is not started, show "Bus Not Started" instead of "Pending" for pending stops */
  busStatus?: BusStatus;
  /** When status is reached, show "Reached at HH:MM" (persists until next trip) */
  reachedAt?: number;
  /** When status is current, show "Reach by {estimatedTime}" */
  showReachBy?: boolean;
}

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  status,
  isStudentStop,
  isLast,
  busStatus,
  reachedAt,
  showReachBy,
}) => {
  const badgeLabel =
    status === 'pending' && busStatus === 'not-started' ? 'Bus Not Started' : undefined;
  const timeLabel =
    status === 'reached' && reachedAt != null
      ? `Reached at ${formatReachedTime(reachedAt)}`
      : showReachBy && stop.estimatedTime
        ? `Reach by ${stop.estimatedTime}`
        : stop.estimatedTime
          ? `Est. ${stop.estimatedTime}`
          : null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 sm:gap-4 animate-fade-in min-w-0',
        isStudentStop && 'relative'
      )}
    >
      <div className="flex-shrink-0">
        <StopIndicator status={status} isStudentStop={isStudentStop} isLast={isLast} />
      </div>
      <div
        className={cn(
          'flex-1 min-w-0 pb-6 overflow-hidden',
          isLast && 'pb-0'
        )}
      >
        <div
          className={cn(
            'rounded-lg p-4 transition-all duration-300 overflow-hidden',
            isStudentStop
              ? 'bg-primary/10 border-2 border-primary shadow-card'
              : status === 'current'
              ? 'bg-accent/10 border border-accent/30'
              : status === 'reached'
              ? 'bg-success/5 border border-success/20'
              : 'bg-card border border-border'
          )}
        >
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3
                  className={cn(
                    'font-semibold text-base truncate',
                    status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                  )}
                  title={stop.name}
                >
                  {stop.name}
                </h3>
                {isStudentStop && (
                  <Star className="w-4 h-4 text-primary fill-primary flex-shrink-0" />
                )}
              </div>
              {/* Reached time / reach-by time always below stop name on its own line */}
              {timeLabel && (
                <div className="flex items-center gap-1.5 mt-1.5 w-full">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span
                    className={cn(
                      'text-sm',
                      status === 'reached' ? 'text-success font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {timeLabel}
                  </span>
                </div>
              )}
            </div>
            <StatusBadge status={status} label={badgeLabel} className="flex-shrink-0 whitespace-nowrap" />
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
