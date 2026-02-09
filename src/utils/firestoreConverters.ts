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

  // Find the current stop index
  const currentStopIndex = liveBus.stops.findIndex(
    (stop: LiveBusStop) => stop.status === "current"
  );

  // Determine bus status based on stops
  let status: BusStatus = "not-started";
  if (liveBus.stops.length > 0) {
    const allReached = liveBus.stops.every((stop) => stop.status === "reached");
    const hasCurrent = liveBus.stops.some((stop) => stop.status === "current");
    
    if (allReached) {
      status = "completed";
    } else if (hasCurrent || currentStopIndex >= 0) {
      status = "running";
    }
  }

  return {
    status,
    currentStopIndex: currentStopIndex >= 0 ? currentStopIndex : -1,
    lastUpdated: liveBus.updatedAt.toDate(),
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

  const stop = liveBus.stops.find((s: LiveBusStop) => s.id === stopId);
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
  if (!liveBus || index < 0 || index >= liveBus.stops.length) {
    return "pending";
  }

  return liveBus.stops[index].status;
};
