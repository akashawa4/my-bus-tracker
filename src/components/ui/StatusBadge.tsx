import { cn } from '@/lib/utils';
import { StopStatus, BusStatus } from '@/types/student';

interface StatusBadgeProps {
  status: StopStatus | BusStatus;
  className?: string;
  /** Override the default label (e.g. "Bus Not Started" for stops when bus not started) */
  label?: string;
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

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, label: labelOverride }) => {
  const config = statusConfig[status];
  const label = labelOverride ?? config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {label}
    </span>
  );
};
