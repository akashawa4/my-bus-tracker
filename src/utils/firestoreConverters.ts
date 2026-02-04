import { Route as FirestoreRoute, LiveBus, RouteStop, LiveBusStop } from "@/types/firestore";
import { Route, Stop, BusState, StopStatus, BusStatus } from "@/types/student";

/**
 * Convert Firestore Route to app Route format
 */
export const convertFirestoreRouteToAppRoute = (firestoreRoute: FirestoreRoute): Route => {
  return {
    id: firestoreRoute.id,
    name: firestoreRoute.name,
    description: firestoreRoute.startingPoint || "",
    stops: firestoreRoute.stops.map((stop: RouteStop) => ({
      id: stop.id,
      name: stop.name,
      order: stop.order,
    })),
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
