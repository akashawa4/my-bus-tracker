import { BusStatus } from '@/types/student';
import { StatusBadge } from './ui/StatusBadge';
import { Bus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusStatusCardProps {
  status: BusStatus;
  lastUpdated: Date;
}

const statusInfo = {
  'not-started': {
    icon: Clock,
    title: 'Bus Not Started',
    description: 'Your bus has not started yet. We\'ll notify you when it begins.',
    bgClass: 'bg-muted/50',
    iconClass: 'text-muted-foreground',
  },
  running: {
    icon: Bus,
    title: 'Bus In Transit',
    description: 'Your bus is on the way! Track progress below.',
    bgClass: 'bg-accent/10',
    iconClass: 'text-accent',
  },
  completed: {
    icon: CheckCircle2,
    title: 'Route Completed',
    description: 'Today\'s route has been completed.',
    bgClass: 'bg-success/10',
    iconClass: 'text-success',
  },
};

export const BusStatusCard: React.FC<BusStatusCardProps> = ({ status, lastUpdated }) => {
  const info = statusInfo[status];
  const Icon = info.icon;

  return (
    <div
      className={cn(
        'rounded-xl p-5 border transition-all duration-300 animate-fade-in',
        info.bgClass,
        status === 'running' ? 'border-accent/30' : 'border-border'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            status === 'running' ? 'bg-accent/20 animate-pulse-soft' : 'bg-background'
          )}
        >
          <Icon className={cn('w-6 h-6', info.iconClass)} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-foreground">{info.title}</h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{info.description}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};
