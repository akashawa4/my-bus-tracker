import { Timestamp } from "firebase/firestore";

// Bus Collection Types
export interface Bus {
  id: string;
  assignedDriverId: string | null;
  assignedRouteId: string | null;
  busNumber: string;
  status: "idle" | "running" | "stopped" | "maintenance";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Driver Collection Types
export interface Driver {
  id: string;
  driverId: string;
  name: string;
  phone: string;
  password: string;
  assignedBusId: string | null;
  status: "active" | "inactive";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Route Collection Types
export interface RouteStop {
  id: string;
  name: string;
  order: number;
}

export interface Route {
  id: string;
  name: string;
  startingPoint: string;
  stops: RouteStop[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// LiveBus Collection Types
export type StopStatus = "reached" | "current" | "pending";

export interface LiveBusStop {
  id: string;
  name: string;
  order: number;
  status: StopStatus;
}

export interface LiveBus {
  id: string;
  busNumber: string;
  driverName: string;
  routeName: string;
  stops: LiveBusStop[];
  startedAt: Timestamp;
  updatedAt: Timestamp;
}

// ChangeRequest Collection Types
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  studentId: string;
  studentName: string;
  currentRoute: string;
  currentStop: string;
  requestedRoute: string;
  requestedStop: string;
  status: ChangeRequestStatus;
  requestedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Student Collection Types
// Matches documents in the "students" collection
export interface Student {
  // Firestore document ID (auto-generated or manual)
  id: string;

  // Business identifiers / profile info
  studentId?: string; // optional because your sample doc uses only "id"
  name: string;
  email: string;
  phone?: string;
  department?: string;
  year?: string;
  status?: string;

  // Auth (NOTE: in production you should use Firebase Auth instead)
  password?: string;

  // Route selection stored on the student document
  routeId?: string;
  routeName?: string;
  stopId?: string;
  stopName?: string;

  // Fields used by the app state
  selectedRouteId?: string;
  selectedStopId?: string;
  hasCompletedSetup?: boolean;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
