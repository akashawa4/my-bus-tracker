import { useMemo } from 'react';
import { useStudent } from '@/context/StudentContext';
import { NotificationBell } from '@/components/NotificationBell';
import { BusStatusCard } from '@/components/BusStatusCard';
import { StopCard } from '@/components/StopCard';
import { LiveBusMap, BusPosition, StopMarker } from '@/components/LiveBusMap';
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

  // Check if route completion was more than 30 minutes ago - if so, reset to pending
  const isCompletedButExpired = (): boolean => {
    if (busState.status !== 'completed') return false;
    const now = new Date();
    const lastUpdated = busState.lastUpdated;
    const timeDiffMs = now.getTime() - lastUpdated.getTime();
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    return timeDiffMs > thirtyMinutesMs;
  };

  const getStopStatus = (index: number): StopStatus => {
    const stop = selectedRoute.stops[index];
    if (!stop) return 'pending';

    // If route was completed more than 30 minutes ago, reset all stops to pending
    if (isCompletedButExpired()) {
      return 'pending';
    }

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

  // Get effective bus status - reset to not-started if completion expired
  const effectiveStatus = isCompletedButExpired() ? 'not-started' : busState.status;

  const studentStop = selectedRoute.stops.find(s => s.id === student.selectedStopId);
  const busNumber = realtimeLocation?.busNumber ?? liveBus?.busNumber;
  const driverName = realtimeLocation?.driverName ?? liveBus?.driverName;
  const gpsText =
    realtimeLocation?.latitude != null && realtimeLocation?.longitude != null
      ? `${realtimeLocation.latitude.toFixed(6)}, ${realtimeLocation.longitude.toFixed(6)}`
      : null;
  const currentStopText = realtimeCurrentStop?.name ?? null;

  // Transform realtime location to BusPosition for map
  const busPosition: BusPosition | null = useMemo(() => {
    if (!realtimeLocation?.latitude || !realtimeLocation?.longitude) return null;

    // Don't show on map if completed and expired
    if (isCompletedButExpired()) return null;

    // Don't show bus position if bus hasn't started yet (prevents showing old RTDB data)
    const currentRouteState = realtimeRouteState ?? realtimeLocation.routeState;
    if (currentRouteState === 'not_started' || currentRouteState === undefined) {
      return null;
    }

    return {
      latitude: realtimeLocation.latitude,
      longitude: realtimeLocation.longitude,
      accuracy: realtimeLocation.accuracy,
      timestamp: realtimeLocation.updatedAt ?? realtimeLocation.timestamp ?? Date.now(),
    };
  }, [realtimeLocation, realtimeRouteState, busState.status, busState.lastUpdated]);

  // Transform route stops to map markers (with static coordinates for demo)
  // In production, these would come from Firestore route data with actual coordinates
  const stopMarkers: StopMarker[] = useMemo(() => {
    // For now, return empty array - stops need latitude/longitude in route data
    // This can be populated when route data includes stop coordinates
    return [];
  }, [selectedRoute.stops, realtimeStops, student.selectedStopId]);

  // Get route state for map
  const routeStateForMap = useMemo(() => {
    if (isCompletedButExpired()) return 'not_started';
    if (realtimeRouteState === 'in_progress') return 'in_progress';
    if (realtimeRouteState === 'completed') return 'completed';
    if (effectiveStatus === 'running') return 'in_progress';
    if (effectiveStatus === 'completed') return 'completed';
    return 'not_started';
  }, [realtimeRouteState, effectiveStatus, busState.status, busState.lastUpdated]);

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
        <BusStatusCard status={effectiveStatus} lastUpdated={busState.lastUpdated} />

        {/* Live Bus Map */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
            Live Bus Location
          </h2>
          <LiveBusMap
            busPosition={busPosition}
            busNumber={busNumber}
            driverName={driverName}
            routeState={routeStateForMap}
            stops={stopMarkers}
            studentStopId={student.selectedStopId}
            height={280}
            autoCenter={false}
            showPath={true}
            maxPathPoints={100}
          />
        </div>

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
          {effectiveStatus === 'not-started' && 'Waiting for bus to start...'}
          {effectiveStatus === 'running' && 'Bus is on the way to your stop'}
          {effectiveStatus === 'completed' && 'Route completed for today'}
        </p>
      </footer>
    </div>
  );
};
