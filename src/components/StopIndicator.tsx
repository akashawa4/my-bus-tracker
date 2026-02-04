import { cn } from '@/lib/utils';
import { StopStatus } from '@/types/student';
import { Check, MapPin, Circle } from 'lucide-react';

interface StopIndicatorProps {
  status: StopStatus;
  isStudentStop: boolean;
  isLast: boolean;
}

export const StopIndicator: React.FC<StopIndicatorProps> = ({
  status,
  isStudentStop,
  isLast,
}) => {
  const getIndicatorStyles = () => {
    const baseStyles = 'w-8 h-8 rounded-full flex items-center justify-center relative z-10';
    
    if (status === 'reached') {
      return cn(baseStyles, 'bg-success');
    }
    if (status === 'current') {
      return cn(baseStyles, 'bg-accent animate-pulse-soft');
    }
    return cn(baseStyles, 'bg-pending/30 border-2 border-pending');
  };

  const getLineStyles = () => {
    if (isLast) return 'hidden';
    
    const baseStyles = 'absolute left-1/2 top-8 w-0.5 h-12 -translate-x-1/2';
    
    if (status === 'reached') {
      return cn(baseStyles, 'bg-success');
    }
    return cn(baseStyles, 'bg-border');
  };

  const getIcon = () => {
    if (status === 'reached') {
      return <Check className="w-4 h-4 text-success-foreground" />;
    }
    if (status === 'current') {
      return <MapPin className="w-4 h-4 text-accent-foreground" />;
    }
    return <Circle className="w-3 h-3 text-pending" />;
  };

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={cn(
          getIndicatorStyles(),
          isStudentStop && 'ring-4 ring-primary/30'
        )}
      >
        {getIcon()}
      </div>
      <div className={getLineStyles()} />
    </div>
  );
};
