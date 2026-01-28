import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Student, Route, BusState, Notification } from '@/types/student';
import { Student as FirestoreStudent, Route as FirestoreRoute, LiveBus } from '@/types/firestore';
import type { RealtimeBusLocation, RealtimeCurrentStop } from '@/types/realtime';
import {
  getRoutes,
  subscribeToRoutes,
  subscribeToLiveBus,
  getStudentByEmail,
  subscribeToStudent,
  createChangeRequest,
  updateStudent,
} from '@/services/firestore';
import { subscribeToRealtimeBusByRouteId } from '@/services/realtimeDb';
import {
  convertFirestoreRouteToAppRoute,
  convertLiveBusToBusState,
  getStopStatusByIndex,
} from '@/utils/firestoreConverters';

interface StudentContextType {
  student: Student | null;
  isLoggedIn: boolean;
  routes: Route[];
  selectedRoute: Route | null;
  liveBus: LiveBus | null;
  realtimeLocation: RealtimeBusLocation | null;
  realtimeRouteState: string | null;
  realtimeCurrentStop: RealtimeCurrentStop | null;
  busState: BusState;
  notifications: Notification[];
  unreadCount: number;
  login: (email: string, password: string) => Promise<boolean>;
  refreshTracking: () => void;
  logout: () => void;
  selectRoute: (routeId: string) => void;
  selectStop: (stopId: string) => void;
  confirmSelection: () => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [liveBus, setLiveBus] = useState<LiveBus | null>(null);
  const [realtimeLocation, setRealtimeLocation] = useState<RealtimeBusLocation | null>(null);
  const [realtimeRouteState, setRealtimeRouteState] = useState<string | null>(null);
  const [realtimeCurrentStop, setRealtimeCurrentStop] = useState<RealtimeCurrentStop | null>(null);
  const [trackingRefreshNonce, setTrackingRefreshNonce] = useState(0);
  const [busState, setBusState] = useState<BusState>({
    status: 'not-started',
    currentStopIndex: -1,
    lastUpdated: new Date(),
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [previousStopIndex, setPreviousStopIndex] = useState<number>(-1);

  const addNotification = useCallback((type: Notification['type'], message: string) => {
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      type,
      message,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const refreshTracking = useCallback(() => {
    setTrackingRefreshNonce((n) => n + 1);
  }, []);

  // Load routes from Firestore
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const firestoreRoutes = await getRoutes();
        const appRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
        setRoutes(appRoutes);
        
        // If student is logged in but route not set, try to set it now
        if (student?.selectedRouteId && !selectedRoute) {
          const route = appRoutes.find((r) => r.id === student.selectedRouteId);
          if (route) {
            setSelectedRoute(route);
          }
        }
      } catch (error) {
        console.error('Error loading routes:', error);
      }
    };

    loadRoutes();

    // Subscribe to route changes
    const unsubscribe = subscribeToRoutes((firestoreRoutes) => {
      const appRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
      setRoutes(appRoutes);
      
      // Update selected route if it exists
      if (selectedRoute) {
        const updatedRoute = appRoutes.find((r) => r.id === selectedRoute.id);
        if (updatedRoute) {
          setSelectedRoute(updatedRoute);
        }
      } else if (student?.selectedRouteId) {
        // If route wasn't set before, try to set it now
        const route = appRoutes.find((r) => r.id === student.selectedRouteId);
        if (route) {
          setSelectedRoute(route);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedRoute, student?.selectedRouteId, trackingRefreshNonce]);

  // Subscribe to Realtime Database bus data by student's routeId
  useEffect(() => {
    const routeId = student?.selectedRouteId;
    if (!routeId) {
      setRealtimeLocation(null);
      setRealtimeRouteState(null);
      setRealtimeCurrentStop(null);
      return;
    }

    const unsubscribe = subscribeToRealtimeBusByRouteId(
      routeId,
      (data) => {
        if (!data) {
          setRealtimeLocation(null);
          setRealtimeRouteState(null);
          setRealtimeCurrentStop(null);
          return;
        }

        setRealtimeLocation(data.location);
        setRealtimeRouteState(data.routeState ?? null);
        setRealtimeCurrentStop(data.currentStop ?? null);

        // Use RTDB as source-of-truth for status + current stop index (matches driver app)
        const rs = (data.routeState ?? data.location.routeState ?? '').toString();
        const status =
          rs === 'completed'
            ? 'completed'
            : rs === 'in_progress'
              ? 'running'
              : 'not-started';

        const ts =
          data.currentStop?.updatedAt ?? data.location.updatedAt ?? data.location.timestamp ?? Date.now();

        // Compute currentStopIndex from RTDB currentStop (prefer stopId match, then order)
        let currentStopIndex = -1;
        if (selectedRoute) {
          const stopId = data.currentStop?.stopId;
          if (stopId) {
            currentStopIndex = selectedRoute.stops.findIndex((s) => s.id === stopId);
          }
          if (currentStopIndex < 0 && typeof data.currentStop?.order === 'number') {
            currentStopIndex = Math.max(0, data.currentStop.order - 1);
          }
          if (currentStopIndex >= selectedRoute.stops.length) {
            currentStopIndex = selectedRoute.stops.length - 1;
          }
        }

        setBusState((prev) => ({
          ...prev,
          status,
          currentStopIndex,
          lastUpdated: new Date(ts),
        }));
      },
      (err) => {
        console.error('RTDB subscribe error:', err);
        setRealtimeLocation(null);
        setRealtimeRouteState(null);
        setRealtimeCurrentStop(null);
      }
    );

    return () => unsubscribe();
  }, [student?.selectedRouteId, selectedRoute, trackingRefreshNonce]);

  // Subscribe to live bus updates when route is selected or student has routeName
  useEffect(() => {
    // Determine route name to subscribe to
    let routeNameToSubscribe: string | null = null;
    
    if (realtimeLocation?.routeName) {
      // Prefer RTDB routeName (comes directly from driver app)
      routeNameToSubscribe = realtimeLocation.routeName;
    } else if (selectedRoute) {
      routeNameToSubscribe = selectedRoute.name;
    } else if (student?.routeName) {
      // Use routeName from student document if route object not loaded yet
      // This happens when student logs in but routes haven't loaded
      routeNameToSubscribe = student.routeName;
    }

    if (!routeNameToSubscribe) {
      setLiveBus(null);
      setBusState({
        status: 'not-started',
        currentStopIndex: -1,
        lastUpdated: new Date(),
      });
      return;
    }

    console.log('Subscribing to live bus for route:', routeNameToSubscribe);

    const unsubscribe = subscribeToLiveBus(
      routeNameToSubscribe,
      (bus) => {
        console.log('Live bus update received:', bus);
        setLiveBus(bus);
        const newBusState = convertLiveBusToBusState(bus);
        setBusState(newBusState);

        // Check for notifications
        if (bus && student?.selectedStopId && selectedRoute) {
          const currentStopIndex = bus.stops.findIndex((s) => s.status === 'current');
          
          // Notify when bus starts
          if (newBusState.status === 'running' && previousStopIndex === -1 && currentStopIndex >= 0) {
            addNotification('bus-started', 'Your bus has started! Track its progress in real-time.');
          }

          // Notify when approaching student's stop
          if (currentStopIndex >= 0 && currentStopIndex !== previousStopIndex) {
            const currentStop = bus.stops[currentStopIndex];
            const studentStopIndex = selectedRoute.stops.findIndex((s) => s.id === student.selectedStopId);
            
            if (studentStopIndex >= 0 && currentStopIndex === studentStopIndex - 1) {
              const nextStop = selectedRoute.stops[studentStopIndex];
              addNotification('stop-reached', `Your stop "${nextStop.name}" is coming up next!`);
            }
          }

          setPreviousStopIndex(currentStopIndex);
        }
      },
      (error) => {
        console.error('Error subscribing to live bus:', error);
      }
    );

    return () => {
      console.log('Unsubscribing from live bus');
      unsubscribe();
    };
  }, [selectedRoute, student, realtimeLocation?.routeName, previousStopIndex, addNotification, trackingRefreshNonce]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // Get student from Firestore
      const firestoreStudent = await getStudentByEmail(email);
      
      if (!firestoreStudent) {
        return false;
      }

      // Simple email/password check against Firestore document
      // NOTE: for production you should use Firebase Auth instead
      const storedPassword = firestoreStudent.password || '';
      if (storedPassword !== password) {
        return false;
      }

      // Ensure routes are loaded before proceeding
      let currentRoutes = routes;
      if (currentRoutes.length === 0) {
        try {
          const firestoreRoutes = await getRoutes();
          currentRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
          setRoutes(currentRoutes);
        } catch (error) {
          console.error('Error loading routes during login:', error);
        }
      }

      // Convert Firestore student to app student format
      const appStudent: Student = {
        id: firestoreStudent.id,
        studentId: firestoreStudent.studentId,
        name: firestoreStudent.name,
        email: firestoreStudent.email,
        // Your current docs use `routeId` / `stopId` fields
        selectedRouteId: firestoreStudent.selectedRouteId ?? firestoreStudent.routeId,
        selectedStopId: firestoreStudent.selectedStopId ?? firestoreStudent.stopId,
        routeName: firestoreStudent.routeName, // Preserve routeName for quick subscription
        // If routeId already exists, treat it as completed setup
        hasCompletedSetup:
          firestoreStudent.hasCompletedSetup || !!firestoreStudent.selectedRouteId || !!firestoreStudent.routeId,
      };

      setStudent(appStudent);
      setIsLoggedIn(true);

      // Set selected route if student has one
      if (appStudent.selectedRouteId) {
        const route = currentRoutes.find((r) => r.id === appStudent.selectedRouteId);
        if (route) {
          setSelectedRoute(route);
        } else {
          // If route not found by ID, try to find by routeName from student document
          if (firestoreStudent.routeName) {
            const routeByName = currentRoutes.find((r) => r.name === firestoreStudent.routeName);
            if (routeByName) {
              setSelectedRoute(routeByName);
            }
          }
        }
      }

      // Subscribe to student updates
      const unsubscribe = subscribeToStudent(firestoreStudent.studentId ?? firestoreStudent.id, (updatedStudent) => {
        if (updatedStudent) {
          const updatedAppStudent: Student = {
            id: updatedStudent.id,
            studentId: updatedStudent.studentId,
            name: updatedStudent.name,
            email: updatedStudent.email,
            selectedRouteId: updatedStudent.selectedRouteId ?? updatedStudent.routeId,
            selectedStopId: updatedStudent.selectedStopId ?? updatedStudent.stopId,
            routeName: updatedStudent.routeName, // Preserve routeName
            hasCompletedSetup: updatedStudent.hasCompletedSetup || false,
          };
          setStudent(updatedAppStudent);

          // Update selected route if changed
          if (updatedAppStudent.selectedRouteId) {
            setRoutes((currentRoutes) => {
              const route = currentRoutes.find((r) => r.id === updatedAppStudent.selectedRouteId);
              if (route) {
                setSelectedRoute(route);
              }
              return currentRoutes;
            });
          }
        }
      });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, [routes]);

  const logout = useCallback(() => {
    setStudent(null);
    setIsLoggedIn(false);
    setSelectedRoute(null);
    setLiveBus(null);
    setRealtimeLocation(null);
    setRealtimeRouteState(null);
    setRealtimeCurrentStop(null);
    setBusState({
      status: 'not-started',
      currentStopIndex: -1,
      lastUpdated: new Date(),
    });
    setNotifications([]);
    setPreviousStopIndex(-1);
  }, []);

  const selectRoute = useCallback((routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    if (route) {
      setSelectedRoute(route);
      setStudent((prev) => prev ? { ...prev, selectedRouteId: routeId, selectedStopId: undefined } : null);
    }
  }, [routes]);

  const selectStop = useCallback((stopId: string) => {
    setStudent((prev) => prev ? { ...prev, selectedStopId: stopId } : null);
  }, []);

  const confirmSelection = useCallback(async () => {
    if (!student) return;

    try {
      // Update student in Firestore
      const firestoreStudent = await getStudentByEmail(student.email);
      if (firestoreStudent) {
        await updateStudent(firestoreStudent.studentId ?? firestoreStudent.id, {
          // App-specific selection fields
          selectedRouteId: student.selectedRouteId,
          selectedStopId: student.selectedStopId,
          hasCompletedSetup: true,

          // Mirror into the main profile fields used in your sample document
          routeId: student.selectedRouteId,
          routeName: selectedRoute?.name,
          stopId: student.selectedStopId,
          stopName: selectedRoute?.stops.find((s) => s.id === student.selectedStopId)?.name,
        });
        // Update will be handled by the subscription
      }
    } catch (error) {
      console.error('Error confirming selection:', error);
    }
  }, [student]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Get stop status helper function
  const getStopStatus = useCallback((index: number): StopStatus => {
    if (!liveBus || !selectedRoute) return 'pending';
    return getStopStatusByIndex(liveBus, index);
  }, [liveBus, selectedRoute]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <StudentContext.Provider
      value={{
        student,
        isLoggedIn,
        routes,
        selectedRoute,
        liveBus,
        realtimeLocation,
        realtimeRouteState,
        realtimeCurrentStop,
        busState,
        notifications,
        unreadCount,
        login,
        refreshTracking,
        logout,
        selectRoute,
        selectStop,
        confirmSelection,
        markNotificationRead,
        clearNotifications,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};
