import { Route as FirestoreRoute, LiveBus, RouteStop, LiveBusStop } from "@/types/firestore";
import { Route, Stop, BusState, StopStatus, BusStatus } from "@/types/student";

/**
 * Convert Firestore Route to app Route format
 */
export const convertFirestoreRouteToAppRoute = (firestoreRoute: FirestoreRoute): Route => {
  // Ensure stops is an array and handle edge cases
  const stops = Array.isArray(firestoreRoute.stops)
    ? firestoreRoute.stops
      .filter((stop: RouteStop) => stop && stop.id && stop.name) // Filter out invalid stops
      .map((stop: RouteStop) => ({
        id: String(stop.id),
        name: String(stop.name),
        order: typeof stop.order === 'number' ? stop.order : 0,
      }))
      .sort((a, b) => a.order - b.order) // Ensure stops are sorted by order
    : [];

  return {
    id: firestoreRoute.id,
    name: firestoreRoute.name || '',
    description: firestoreRoute.startingPoint || "",
    stops,
  };
};

/**
 * Convert LiveBus to BusState
 */
export const convertLiveBusToBusState = (liveBus: LiveBus | null): BusState => {
  if (!liveBus) {
    return {
      status: "not-started",
      currentStopIndex: -1,
      lastUpdated: new Date(),
    };
  }

  const stops = Array.isArray(liveBus.stops) ? liveBus.stops : [];

  // Find the current stop index
  const currentStopIndex = stops.length > 0
    ? stops.findIndex((stop: LiveBusStop) => stop.status === "current")
    : -1;

  // Determine bus status
  let status: BusStatus = "not-started";

  if (stops.length > 0) {
    // If we have stops data, use stop statuses
    const allReached = stops.every((stop) => stop.status === "reached");
    const hasCurrent = stops.some((stop) => stop.status === "current");

    if (allReached) {
      status = "completed";
    } else if (hasCurrent || currentStopIndex >= 0) {
      status = "running";
    }
  } else {
    // No stops array — use routeState from driver data
    const routeState = (liveBus as any).routeState || (liveBus as any).status;
    if (routeState === 'in_progress' || routeState === 'running') {
      status = "running";
    } else if (routeState === 'completed' || routeState === 'finished') {
      status = "completed";
    }
  }

  // Handle updatedAt — could be Firestore Timestamp, Date, or number
  let lastUpdated: Date;
  try {
    if (liveBus.updatedAt && typeof (liveBus.updatedAt as any).toDate === 'function') {
      lastUpdated = (liveBus.updatedAt as any).toDate();
    } else if (liveBus.updatedAt instanceof Date) {
      lastUpdated = liveBus.updatedAt;
    } else if (typeof (liveBus as any).timestamp === 'number') {
      lastUpdated = new Date((liveBus as any).timestamp);
    } else {
      lastUpdated = new Date();
    }
  } catch {
    lastUpdated = new Date();
  }

  return {
    status,
    currentStopIndex: currentStopIndex >= 0 ? currentStopIndex : -1,
    lastUpdated,
  };
};

/**
 * Get stop status from LiveBus
 */
export const getStopStatusFromLiveBus = (
  liveBus: LiveBus | null,
  stopId: string
): StopStatus => {
  if (!liveBus) return "pending";

  const stops = Array.isArray(liveBus.stops) ? liveBus.stops : [];
  const stop = stops.find((s: LiveBusStop) => s.id === stopId);
  if (!stop) return "pending";

  return stop.status;
};

/**
 * Get stop status by index from LiveBus
 */
export const getStopStatusByIndex = (
  liveBus: LiveBus | null,
  index: number
): StopStatus => {
  const stops = liveBus && Array.isArray(liveBus.stops) ? liveBus.stops : [];
  if (index < 0 || index >= stops.length) {
    return "pending";
  }

  return stops[index].status;
};
