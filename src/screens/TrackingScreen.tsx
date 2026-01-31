import { useStudent } from '@/context/StudentContext';
import { NotificationBell } from '@/components/NotificationBell';
import { BusStatusCard } from '@/components/BusStatusCard';
import { StopCard } from '@/components/StopCard';
import { Button } from '@/components/ui/button';
import { StopStatus } from '@/types/student';
import { LogOut, MapPin, Bus, User, BadgeCheck } from 'lucide-react';

export const TrackingScreen: React.FC = () => {
  const {
    student,
    selectedRoute,
    liveBus,
    realtimeLocation,
    realtimeRouteState,
    realtimeCurrentStop,
    realtimeStops,
    busState,
    refreshTracking,
    logout,
  } = useStudent();

  if (!selectedRoute || !student) return null;

  const getStopStatus = (index: number): StopStatus => {
    const stop = selectedRoute.stops[index];
    if (!stop) return 'pending';
    // Prefer RTDB stops (keys "1-1", "1-2", ...) for per-stop status
    if (realtimeStops && typeof realtimeStops[stop.id]?.status === 'string') {
      const s = realtimeStops[stop.id].status as string;
      if (s === 'reached' || s === 'current' || s === 'pending') return s as StopStatus;
    }
    if (busState.status === 'not-started') return 'pending';
    if (busState.status === 'completed') return 'reached';
    if (index < busState.currentStopIndex) return 'reached';
    if (index === busState.currentStopIndex) return 'current';
    return 'pending';
  };

  const studentStop = selectedRoute.stops.find(s => s.id === student.selectedStopId);
  const busNumber = realtimeLocation?.busNumber ?? liveBus?.busNumber;
  const driverName = realtimeLocation?.driverName ?? liveBus?.driverName;
  const gpsText =
    realtimeLocation?.latitude != null && realtimeLocation?.longitude != null
      ? `${realtimeLocation.latitude.toFixed(6)}, ${realtimeLocation.longitude.toFixed(6)}`
      : null;
  const currentStopText = realtimeCurrentStop?.name ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">{student.name}</h1>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={logout}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Route, Stop & Bus info */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
            <Bus className="w-4 h-4 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Route</p>
              <p className="text-sm font-medium text-foreground truncate">
                {selectedRoute.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
            <MapPin className="w-4 h-4 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-primary/80">Your stop</p>
              <p className="text-sm font-medium text-primary truncate">
                {studentStop?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
            <BadgeCheck className="w-4 h-4 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bus & Driver</p>
              <p className="text-xs font-medium text-foreground truncate">
                {busNumber ?? 'Bus not assigned'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {driverName ?? 'Driver not assigned'}
              </p>
              {gpsText && (
                <p className="text-[11px] text-muted-foreground truncate">
                  GPS: {gpsText}
                </p>
              )}
              {realtimeRouteState && (
                <p className="text-[11px] text-muted-foreground truncate">
                  State: {realtimeRouteState}
                </p>
              )}
              {currentStopText && (
                <p className="text-[11px] text-muted-foreground truncate">
                  Current stop: {currentStopText}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        {/* Bus Status */}
        <BusStatusCard status={busState.status} lastUpdated={busState.lastUpdated} />

        {/* Route Progress */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
            Route Progress
          </h2>
          
          <div className="space-y-0">
            {selectedRoute.stops.map((stop, index) => (
              <StopCard
                key={stop.id}
                stop={stop}
                status={getStopStatus(index)}
                isStudentStop={stop.id === student.selectedStopId}
                isLast={index === selectedRoute.stops.length - 1}
              />
            ))}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full h-11 rounded-xl"
              onClick={refreshTracking}
            >
              Refresh
            </Button>
          </div>
        </div>
      </main>

      {/* Info Footer */}
      <footer className="bg-card border-t border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">
          {busState.status === 'not-started' && 'Waiting for bus to start...'}
          {busState.status === 'running' && 'Bus is on the way to your stop'}
          {busState.status === 'completed' && 'Route completed for today'}
        </p>
      </footer>
    </div>
  );
};
