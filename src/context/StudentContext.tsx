import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Student, Route, BusState, AppNotification, StopStatus } from '@/types/student';
import { Student as FirestoreStudent, Route as FirestoreRoute, LiveBus } from '@/types/firestore';
import type { RealtimeBusLocation, RealtimeCurrentStop, RealtimeStopEntry } from '@/types/realtime';
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
  initFCMForStudent,
  refreshAndSaveFCMToken,
  registerServiceWorker,
  requestNotificationPermission,
  setupForegroundMessageHandler,
  showSystemNotification,
  updateStudentRouteStopInRTDB,
} from '@/services/fcm';
import {
  convertFirestoreRouteToAppRoute,
  convertLiveBusToBusState,
  getStopStatusByIndex,
} from '@/utils/firestoreConverters';
import { toast } from 'sonner';

const SESSION_STORAGE_KEY = 'bus_tracker_student_session';

interface StudentContextType {
  student: Student | null;
  isLoggedIn: boolean;
  routes: Route[];
  selectedRoute: Route | null;
  liveBus: LiveBus | null;
  realtimeLocation: RealtimeBusLocation | null;
  realtimeRouteState: string | null;
  realtimeCurrentStop: RealtimeCurrentStop | null;
  /** RTDB stops keyed by stop id e.g. "1-1", "1-2" */
  realtimeStops: Record<string, RealtimeStopEntry> | null;
  busState: BusState;
  notifications: AppNotification[];
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
  const [realtimeStops, setRealtimeStops] = useState<Record<string, RealtimeStopEntry> | null>(null);
  const [trackingRefreshNonce, setTrackingRefreshNonce] = useState(0);
  const [busState, setBusState] = useState<BusState>({
    status: 'not-started',
    currentStopIndex: -1,
    lastUpdated: new Date(),
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [previousStopIndex, setPreviousStopIndex] = useState<number>(-1);
  const [sessionRestored, setSessionRestored] = useState(false);

  // *** EARLY SERVICE WORKER REGISTRATION AND NOTIFICATION PERMISSION REQUEST ***
  // This ensures the SW is registered and notifications are prompted immediately when app loads
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('[App] Notifications or Service Workers not supported');
      return;
    }

    // Log current state for debugging
    console.log('[App] === FCM Setup Check ===');
    console.log('[App] Notification permission:', Notification.permission);
    console.log('[App] Service Worker support:', 'serviceWorker' in navigator);

    // Register service worker early (required for FCM)
    registerServiceWorker().then((registration) => {
      if (registration) {
        console.log('[App] ✅ Service Worker registered successfully');
      } else {
        console.error('[App] ❌ Service Worker registration failed');
      }
    });

    // Only prompt if permission hasn't been decided yet
    if (Notification.permission === 'default') {
      // Show a toast guiding the user
      const timer = setTimeout(() => {
        toast.info('🔔 Enable Notifications', {
          description: 'Get real-time bus alerts and never miss your stop!',
          duration: 15000,
          action: {
            label: 'Enable Now',
            onClick: () => {
              console.log('[App] User clicked Enable Now button');
              requestNotificationPermission().then((permission) => {
                console.log('[App] Permission result:', permission);
                if (permission === 'granted') {
                  toast.success('Notifications enabled!', {
                    description: 'You will now receive bus alerts.',
                  });
                } else if (permission === 'denied') {
                  toast.error('Notifications blocked', {
                    description: 'Please enable notifications in your browser settings to get bus alerts.',
                  });
                }
              });
            },
          },
        });

        // Also trigger the native browser permission prompt after a short delay
        setTimeout(() => {
          if (Notification.permission === 'default') {
            console.log('[App] Auto-triggering notification permission prompt...');
            requestNotificationPermission().then((permission) => {
              console.log('[App] Auto-prompt permission result:', permission);
              if (permission === 'granted') {
                toast.success('Notifications enabled!', {
                  description: 'You will now receive bus updates.',
                });
              }
            });
          }
        }, 2000);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      console.log('[App] Notification permission already decided:', Notification.permission);
    }
  }, []);

  // Restore session from localStorage on mount (so refresh doesn't logout)
  useEffect(() => {
    if (sessionRestored || isLoggedIn) return;
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        setSessionRestored(true);
        return;
      }
      const { email } = JSON.parse(raw) as { email: string };
      if (!email) {
        setSessionRestored(true);
        return;
      }
      getStudentByEmail(email).then((firestoreStudent) => {
        if (!firestoreStudent) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setSessionRestored(true);
          return;
        }
        getRoutes().then((firestoreRoutes) => {
          const appRoutes = firestoreRoutes.map(convertFirestoreRouteToAppRoute);
          setRoutes(appRoutes);
          const appStudent: Student = {
            id: firestoreStudent.id,
            studentId: firestoreStudent.studentId,
            name: firestoreStudent.name,
            email: firestoreStudent.email,
            selectedRouteId: firestoreStudent.selectedRouteId ?? firestoreStudent.routeId,
            selectedStopId: firestoreStudent.selectedStopId ?? firestoreStudent.stopId,
            routeName: firestoreStudent.routeName,
            hasCompletedSetup:
              firestoreStudent.hasCompletedSetup || !!firestoreStudent.selectedRouteId || !!firestoreStudent.routeId,
          };
          setStudent(appStudent);
          setIsLoggedIn(true);
          if (appStudent.selectedRouteId) {
            const route = appRoutes.find((r) => r.id === appStudent.selectedRouteId);
            if (route) setSelectedRoute(route);
            else if (firestoreStudent.routeName) {
              const byName = appRoutes.find((r) => r.name === firestoreStudent.routeName);
              if (byName) setSelectedRoute(byName);
            }
          }
          setSessionRestored(true);
        });
      });
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setSessionRestored(true);
    }
  }, [sessionRestored, isLoggedIn]);

  // FCM: request permission, get token, save to students/{studentId}/fcmToken (+ routeId, stopId); handle foreground
  useEffect(() => {
    if (!student) return;
    // Use same key as RTDB: students/1 → student.id (Firestore doc id) so Cloud Function finds fcmToken
    const studentId = student.id;
    if (!studentId) return;

    const opts = { routeId: student.selectedRouteId, stopId: student.selectedStopId };

    const runFCM = () => {
      initFCMForStudent(studentId, opts).then((ok) => {
        if (ok) {
          console.info('[FCM] Token saved to RTDB students/' + studentId);
        } else {
          toast.error('Notifications not enabled', {
            description: 'Allow notifications in browser settings to get bus alerts.',
          });
        }
      }).catch((err) => {
        console.warn('FCM init failed:', err);
        toast.error('Could not enable notifications', { description: String(err?.message || err) });
      });
    };

    // Keep RTDB students/{studentId} in sync so Cloud Functions can find students to notify
    updateStudentRouteStopInRTDB(studentId, student.selectedRouteId, student.selectedStopId).catch(() => { });

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      toast('Get bus updates', {
        description: 'Allow notifications to know when your bus is near.',
        action: {
          label: 'Allow',
          onClick: () => {
            requestNotificationPermission().then((permission) => {
              if (permission === 'granted') runFCM();
            });
          },
        },
        duration: 12000,
      });
      // Proactively show browser permission prompt after a short delay so user can allow
      const t = setTimeout(() => {
        requestNotificationPermission().then((permission) => {
          if (permission === 'granted') runFCM();
        });
      }, 1500);
      return () => clearTimeout(t);
    }

    runFCM();

    // When tab becomes visible, refresh token and save (in case token rotated)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
        refreshAndSaveFCMToken(studentId, opts).catch(() => { });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const unsubscribe = setupForegroundMessageHandler((payload) => {
      const title = payload.notification?.title ?? (payload.data as Record<string, string> | undefined)?.title ?? 'Bus Tracker';
      const body = payload.notification?.body ?? (payload.data as Record<string, string> | undefined)?.body ?? '';
      // Show system notification (OS tray) like on phone/laptop
      showSystemNotification(title, { body, tag: 'bus-tracker-fcm' });
      // Also show in-app toast when app is focused
      toast(title, { description: body || undefined });
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [student]);

  const addNotification = useCallback((type: AppNotification['type'], message: string) => {
    const notification: AppNotification = {
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
          setRealtimeStops(null);
          return;
        }

        setRealtimeLocation(data.location);
        setRealtimeRouteState(data.routeState ?? null);
        setRealtimeCurrentStop(data.currentStop ?? null);
        setRealtimeStops(data.stops ?? null);

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

        // Compute currentStopIndex from RTDB: prefer stops[id].status === 'current', else currentStop
        let currentStopIndex = -1;
        if (selectedRoute) {
          if (data.stops && typeof data.stops === 'object') {
            const entries = Object.entries(data.stops);
            const current = entries.find(([, s]) => s?.status === 'current');
            if (current) {
              const [stopId] = current;
              currentStopIndex = selectedRoute.stops.findIndex((s) => s.id === stopId);
              if (currentStopIndex < 0 && typeof current[1].order === 'number') {
                currentStopIndex = Math.max(0, current[1].order - 1);
              }
            }
          }
          if (currentStopIndex < 0 && data.currentStop?.stopId) {
            currentStopIndex = selectedRoute.stops.findIndex((s) => s.id === data.currentStop!.stopId);
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
        setRealtimeStops(null);
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
          const studentStopIndex = selectedRoute.stops.findIndex((s) => s.id === student.selectedStopId);
          const studentStopName = studentStopIndex >= 0 ? selectedRoute.stops[studentStopIndex].name : 'your stop';

          // Notify when bus starts
          if (newBusState.status === 'running' && previousStopIndex === -1 && currentStopIndex >= 0) {
            const title = '🚌 Bus Started!';
            const body = 'Your bus has started! Track its progress in real-time.';
            addNotification('bus-started', body);
            showSystemNotification(title, { body, tag: 'bus-started' });
            console.log('[Notification] Bus started notification sent');
          }

          // Only check stop-based notifications if stop index changed
          if (currentStopIndex >= 0 && currentStopIndex !== previousStopIndex && studentStopIndex >= 0) {

            // Notify when bus is ONE stop away from student's stop
            if (currentStopIndex === studentStopIndex - 1) {
              const title = '📍 Bus Approaching!';
              const body = `Your stop "${studentStopName}" is coming up next! Get ready.`;
              addNotification('stop-approaching', body);
              showSystemNotification(title, { body, tag: 'bus-approaching' });
              console.log('[Notification] Bus approaching notification sent - 1 stop away');
            }

            // Notify when bus arrives AT student's stop
            if (currentStopIndex === studentStopIndex) {
              const title = '🎯 Bus Arrived!';
              const body = `Bus has arrived at "${studentStopName}"! Time to board.`;
              addNotification('stop-reached', body);
              showSystemNotification(title, { body, tag: 'bus-arrived' });
              console.log('[Notification] Bus arrived at student stop notification sent');
            }

            // Notify if bus has PASSED student's stop (missed it)
            if (currentStopIndex === studentStopIndex + 1 && previousStopIndex === studentStopIndex) {
              const title = '⚠️ Bus Passed Your Stop';
              const body = `The bus has passed "${studentStopName}". Please contact the driver if needed.`;
              addNotification('alert', body);
              showSystemNotification(title, { body, tag: 'bus-passed' });
              console.log('[Notification] Bus passed student stop notification sent');
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
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: appStudent.email }));
      } catch {
        // ignore
      }

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
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setStudent(null);
    setIsLoggedIn(false);
    setSelectedRoute(null);
    setLiveBus(null);
    setRealtimeLocation(null);
    setRealtimeRouteState(null);
    setRealtimeCurrentStop(null);
    setRealtimeStops(null);
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
        // So Cloud Functions can find which students to notify (use Firestore doc id = RTDB students/{id})
        updateStudentRouteStopInRTDB(firestoreStudent.id, student.selectedRouteId, student.selectedStopId).catch(() => { });
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
        realtimeStops,
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
