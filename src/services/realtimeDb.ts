import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type {
  RealtimeBusesRoot,
  RealtimeBusLocation,
  RealtimeCurrentStop,
  RealtimeStopEntry,
} from "@/types/realtime";

type Unsubscribe = () => void;

/**
 * Find bus in RTDB that matches the given routeId (Firestore document ID)
 * Falls back to routeName matching if routeId doesn't match
 * 
 * @param buses - RTDB buses root object
 * @param routeId - Firestore route document ID (e.g., "JzvFUaupvbmt16SQQeYi")
 * @param routeName - Route name for fallback matching (e.g., "Route no.3-Kolhapur to Kagal")
 */
function pickBusForRouteId(
  buses: RealtimeBusesRoot | null | undefined,
  routeId: string,
  routeName?: string | null
) {
  if (!buses) return null;
  const entries = Object.entries(buses);
  
  for (const [busKey, node] of entries) {
    const loc = node?.location;
    if (!loc) continue;
    
    // First try matching by routeId (Firestore document ID)
    // This is the primary matching method for the new system
    if (loc.routeId === routeId) {
      console.log(`[RTDB] Matched bus ${busKey} by routeId:`, routeId);
      return { busKey, node, location: loc };
    }
    
    // Fallback: match by routeName if routeId doesn't match
    // This handles cases where RTDB has routeName but routeId might be different format
    // or when driver app hasn't updated routeId yet
    if (routeName && loc.routeName === routeName) {
      console.log(`[RTDB] Matched bus ${busKey} by routeName (fallback):`, routeName);
      return { busKey, node, location: loc };
    }
  }
  
  console.warn(`[RTDB] No bus found for routeId: ${routeId}, routeName: ${routeName}`);
  return null;
}

/**
 * Realtime bus data structure
 * NEW: RTDB path is /buses/{busNumber}/ where busNumber is like "BUS-002"
 */
export type RealtimeBusData = {
  busNumber: string;
  location: RealtimeBusLocation;
  routeState?: string;
  currentStop?: RealtimeCurrentStop;
  /** stops keyed by stop id (e.g., "JzvFUaupvbmt16SQQeYi-1770657366911") */
  stops?: Record<string, RealtimeStopEntry>;
  /** stops keyed by name (e.g., "nandgaon") */
  stopsByName?: Record<string, RealtimeStopEntry>;
};

/**
 * Subscribe to RTDB bus data by bus number (NEW METHOD)
 * RTDB path: /buses/{busNumber}/
 * 
 * @param busNumber - Bus number (e.g., "BUS-002")
 * @param onData - Callback when data changes
 * @param onError - Error callback
 * @returns Unsubscribe function
 */
export function subscribeToRealtimeBusByBusNumber(
  busNumber: string,
  onData: (data: RealtimeBusData | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const busRef = ref(rtdb, `buses/${busNumber}`);

  const unsubscribe = onValue(
    busRef,
    (snap) => {
      const busNode = snap.val() as RealtimeBusNode | null;
      
      if (!busNode || !busNode.location) {
        onData(null);
        return;
      }

      const raw = busNode.routeState;
      const effectiveRouteState =
        typeof raw === "string"
          ? raw
          : (raw as { state?: string } | undefined)?.state ??
            (busNode.location.routeState as string | undefined);

      const stops = busNode.stops;
      const stopsRecord =
        stops && !Array.isArray(stops) && typeof stops === "object"
          ? (stops as Record<string, RealtimeStopEntry>)
          : undefined;
      const stopsByName =
        busNode.stopsByName && typeof busNode.stopsByName === "object"
          ? (busNode.stopsByName as Record<string, RealtimeStopEntry>)
          : undefined;

      onData({
        busNumber,
        location: busNode.location,
        routeState: effectiveRouteState,
        currentStop: busNode.currentStop,
        stops: stopsRecord,
        stopsByName,
      });
    },
    (err) => {
      console.error(`[RTDB] Error subscribing to bus ${busNumber}:`, err);
      if (onError) onError(err as unknown as Error);
      onData(null);
    }
  );

  return unsubscribe;
}

/**
 * DEPRECATED: Old method that searches all buses
 * Use subscribeToRealtimeBusByBusNumber instead after finding bus via Firestore
 * 
 * @deprecated Use getBusByRouteId from firestore.ts, then subscribeToRealtimeBusByBusNumber
 */
export function subscribeToRealtimeBusByRouteId(
  routeId: string,
  onData: (data: RealtimeBusData | null) => void,
  onError?: (err: Error) => void,
  routeName?: string | null
): Unsubscribe {
  const busesRef = ref(rtdb, "buses");

  const unsubscribe = onValue(
    busesRef,
    (snap) => {
      const buses = snap.val() as RealtimeBusesRoot | null;
      const match = pickBusForRouteId(buses, routeId, routeName);
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
        busNumber: match.busKey, // busKey is now busNumber
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

