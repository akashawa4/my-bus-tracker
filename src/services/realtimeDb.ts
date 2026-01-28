import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { RealtimeBusesRoot, RealtimeBusLocation, RealtimeCurrentStop } from "@/types/realtime";

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
export function subscribeToRealtimeBusByRouteId(
  routeId: string,
  onData: (
    data:
      | { busKey: string; location: RealtimeBusLocation; routeState?: string; currentStop?: RealtimeCurrentStop }
      | null
  ) => void,
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

      const effectiveRouteState =
        match.node?.routeState?.state ?? (match.location.routeState as string | undefined);

      onData({
        busKey: match.busKey,
        location: match.location,
        routeState: effectiveRouteState,
        currentStop: match.node?.currentStop,
      });
    },
    (err) => {
      if (onError) onError(err as unknown as Error);
      onData(null);
    }
  );

  return unsubscribe;
}

