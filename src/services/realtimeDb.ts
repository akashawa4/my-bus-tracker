import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type {
  RealtimeBusesRoot,
  RealtimeBusLocation,
  RealtimeCurrentStop,
  RealtimeStopEntry,
} from "@/types/realtime";

type Unsubscribe = () => void;

function pickBusForRouteId(buses: RealtimeBusesRoot | null | undefined, routeId: string) {
  if (!buses) return null;
  const entries = Object.entries(buses);
  for (const [busKey, node] of entries) {
    const loc = node?.location;
    if (loc?.routeId === routeId) {
      return { busKey, node, location: loc };
    }
  }
  return null;
}

/**
 * Subscribes to RTDB `/buses` and returns the matching bus `location`
 * for the given `routeId` (from student doc).
 *
 * Driver app format:
 *   /buses/BUS-001/location/{ busNumber, driverName, lat, lng, routeId, routeName, routeState, ... }
 */
export type RealtimeBusData = {
  busKey: string;
  location: RealtimeBusLocation;
  routeState?: string;
  currentStop?: RealtimeCurrentStop;
  /** stops keyed by stop id e.g. "1-1", "1-2" */
  stops?: Record<string, RealtimeStopEntry>;
  /** stops keyed by name e.g. "bus_stand", "railway_station" */
  stopsByName?: Record<string, RealtimeStopEntry>;
};

export function subscribeToRealtimeBusByRouteId(
  routeId: string,
  onData: (data: RealtimeBusData | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const busesRef = ref(rtdb, "buses");

  const unsubscribe = onValue(
    busesRef,
    (snap) => {
      const buses = snap.val() as RealtimeBusesRoot | null;
      const match = pickBusForRouteId(buses, routeId);
      if (!match || !match.location) {
        onData(null);
        return;
      }

      const raw = match.node?.routeState;
      const effectiveRouteState =
        typeof raw === "string"
          ? raw
          : (raw as { state?: string } | undefined)?.state ??
            (match.location.routeState as string | undefined);

      const stops = match.node?.stops;
      const stopsRecord =
        stops && !Array.isArray(stops) && typeof stops === "object"
          ? (stops as Record<string, RealtimeStopEntry>)
          : undefined;
      const stopsByName =
        match.node?.stopsByName && typeof match.node.stopsByName === "object"
          ? (match.node.stopsByName as Record<string, RealtimeStopEntry>)
          : undefined;

      onData({
        busKey: match.busKey,
        location: match.location,
        routeState: effectiveRouteState,
        currentStop: match.node?.currentStop,
        stops: stopsRecord,
        stopsByName,
      });
    },
    (err) => {
      if (onError) onError(err as unknown as Error);
      onData(null);
    }
  );

  return unsubscribe;
}

