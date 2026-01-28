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

export interface RealtimeBusNode {
  currentStop?: RealtimeCurrentStop;
  location?: RealtimeBusLocation;
  routeState?: {
    state?: RealtimeRouteState;
    updatedAt?: number;
  };
}

export type RealtimeBusesRoot = Record<string, RealtimeBusNode>;

