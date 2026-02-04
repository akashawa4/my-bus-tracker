export interface Student {
  id: string;
  studentId?: string; // Firestore studentId field (e.g., "STU-2024-001")
  name: string;
  email: string;
  selectedRouteId?: string;
  selectedStopId?: string;
  routeName?: string; // Route name from student document (for quick subscription)
  hasCompletedSetup: boolean;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  stops: Stop[];
}

export interface Stop {
  id: string;
  name: string;
  order: number;
  estimatedTime?: string;
}

export type StopStatus = 'reached' | 'current' | 'pending';

export type BusStatus = 'not-started' | 'running' | 'completed';

export interface BusState {
  status: BusStatus;
  currentStopIndex: number;
  lastUpdated: Date;
}

/** In-app notification (renamed to avoid conflict with browser global Notification). */
export interface AppNotification {
  id: string;
  type: 'bus-started' | 'stop-approaching' | 'stop-reached' | 'alert' | 'info';
  message: string;
  timestamp: Date;
  read: boolean;
}
