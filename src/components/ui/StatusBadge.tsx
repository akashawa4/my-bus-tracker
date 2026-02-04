import { cn } from '@/lib/utils';
import { StopStatus, BusStatus } from '@/types/student';

interface StatusBadgeProps {
  status: StopStatus | BusStatus;
  className?: string;
}

const statusConfig = {
  reached: {
    bg: 'bg-success',
    text: 'text-success-foreground',
    label: 'Reached',
  },
  current: {
    bg: 'bg-accent',
    text: 'text-accent-foreground',
    label: 'On the Way',
  },
  pending: {
    bg: 'bg-pending',
    text: 'text-pending-foreground',
    label: 'Pending',
  },
  'not-started': {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    label: 'Not Started',
  },
  running: {
    bg: 'bg-accent',
    text: 'text-accent-foreground',
    label: 'In Transit',
  },
  completed: {
    bg: 'bg-success',
    text: 'text-success-foreground',
    label: 'Completed',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
};
