export type RealtimeRouteState = "not_started" | "in_progress" | "completed" | string;

export interface RealtimeBusLocation {
  accuracy?: number;
  busNumber: string;
  driverId?: string;
  driverName?: string;
  latitude?: number;
  longitude?: number;
  routeId?: string;
  routeName?: string;
  routeState?: RealtimeRouteState;
  timestamp?: number;
  updatedAt?: number;
}

export interface RealtimeCurrentStop {
  name?: string;
  order?: number;
  status?: string; // "current" | "reached" | "pending"
  stopId?: string; // e.g. "1-4"
  updatedAt?: number;
}

/** One stop entry in buses/BUS-XXX/stops (array or map) */
export interface RealtimeStopEntry {
  id?: string;
  name?: string;
  order?: number;
  status?: string;
  stopId?: string;
  updatedAt?: number;
}

/** buses/BUS-XXX/routeState can be string or { state, updatedAt } */
export type RealtimeRouteStateNode =
  | string
  | { state?: RealtimeRouteState; updatedAt?: number };

export interface RealtimeBusNode {
  currentStop?: RealtimeCurrentStop;
  location?: RealtimeBusLocation;
  /** "in_progress" | "completed" | { state, updatedAt } */
  routeState?: RealtimeRouteStateNode;
  stops?: RealtimeStopEntry[] | Record<string, RealtimeStopEntry>;
  stopsByName?: Record<string, RealtimeStopEntry>;
}

export type RealtimeBusesRoot = Record<string, RealtimeBusNode>;

