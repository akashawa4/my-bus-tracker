import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  Timestamp,
  DocumentSnapshot,
  QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Bus,
  Driver,
  Route,
  LiveBus,
  ChangeRequest,
  Student,
} from "@/types/firestore";

// ==================== Routes ====================
export const getRoutes = async (): Promise<Route[]> => {
  const routesRef = collection(db, "routes");
  const q = query(routesRef, orderBy("name"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Route[];
};

export const getRouteById = async (routeId: string): Promise<Route | null> => {
  const routeRef = doc(db, "routes", routeId);
  const routeSnap = await getDoc(routeRef);
  
  if (routeSnap.exists()) {
    return { id: routeSnap.id, ...routeSnap.data() } as Route;
  }
  return null;
};

export const subscribeToRoutes = (
  callback: (routes: Route[]) => void
): (() => void) => {
  const routesRef = collection(db, "routes");
  const q = query(routesRef, orderBy("name"));
  
  return onSnapshot(q, (querySnapshot) => {
    const routes = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Route[];
    callback(routes);
  });
};

// ==================== Live Buses ====================
export const getLiveBuses = async (): Promise<LiveBus[]> => {
  const liveBusesRef = collection(db, "liveBuses");
  const querySnapshot = await getDocs(liveBusesRef);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LiveBus[];
};

export const getLiveBusByRouteName = async (
  routeName: string
): Promise<LiveBus | null> => {
  const liveBusesRef = collection(db, "liveBuses");
  const q = query(liveBusesRef, where("routeName", "==", routeName));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as LiveBus;
  }
  return null;
};

export const getLiveBusByRouteId = async (
  routeId: string
): Promise<LiveBus | null> => {
  // First get the route to find its name
  const route = await getRouteById(routeId);
  if (!route) return null;
  
  // Then get live bus by route name
  return getLiveBusByRouteName(route.name);
};

export const subscribeToLiveBus = (
  routeName: string,
  callback: (liveBus: LiveBus | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const liveBusesRef = collection(db, "liveBuses");
  const q = query(liveBusesRef, where("routeName", "==", routeName));
  
  return onSnapshot(
    q,
    (querySnapshot) => {
      console.log(`Live bus query snapshot for route "${routeName}":`, {
        empty: querySnapshot.empty,
        size: querySnapshot.size,
        docs: querySnapshot.docs.map(d => ({ id: d.id, data: d.data() }))
      });
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const liveBusData = { id: doc.id, ...doc.data() } as LiveBus;
        console.log('Live bus data:', liveBusData);
        callback(liveBusData);
      } else {
        console.warn(`No live bus found for route: "${routeName}"`);
        callback(null);
      }
    },
    (error) => {
      console.error('Error in live bus subscription:', error);
      if (onError) {
        onError(error);
      }
    }
  );
};

export const subscribeToLiveBuses = (
  callback: (liveBuses: LiveBus[]) => void
): (() => void) => {
  const liveBusesRef = collection(db, "liveBuses");
  
  return onSnapshot(liveBusesRef, (querySnapshot) => {
    const liveBuses = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as LiveBus[];
    callback(liveBuses);
  });
};

// ==================== Buses ====================
export const getBuses = async (): Promise<Bus[]> => {
  const busesRef = collection(db, "buses");
  const querySnapshot = await getDocs(busesRef);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Bus[];
};

export const getBusById = async (busId: string): Promise<Bus | null> => {
  const busRef = doc(db, "buses", busId);
  const busSnap = await getDoc(busRef);
  
  if (busSnap.exists()) {
    return { id: busSnap.id, ...busSnap.data() } as Bus;
  }
  return null;
};

/**
 * Get bus by assigned route ID (NEW: Find which bus serves a route)
 * @param routeId - Firestore route document ID (e.g., "m8pLb0vJ40ThcANbdpo3")
 * @returns Bus document or null if not found
 */
export const getBusByRouteId = async (routeId: string): Promise<Bus | null> => {
  const busesRef = collection(db, "buses");
  const q = query(busesRef, where("assignedRouteId", "==", routeId));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Bus;
  }
  return null;
};

/**
 * Subscribe to bus updates by assigned route ID
 * @param routeId - Firestore route document ID
 * @param callback - Callback function when bus data changes
 * @returns Unsubscribe function
 */
export const subscribeToBusByRouteId = (
  routeId: string,
  callback: (bus: Bus | null) => void
): (() => void) => {
  const busesRef = collection(db, "buses");
  const q = query(busesRef, where("assignedRouteId", "==", routeId));
  
  return onSnapshot(q, (querySnapshot) => {
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      callback({ id: doc.id, ...doc.data() } as Bus);
    } else {
      callback(null);
    }
  });
};

// ==================== Drivers ====================
export const getDrivers = async (): Promise<Driver[]> => {
  const driversRef = collection(db, "drivers");
  const querySnapshot = await getDocs(driversRef);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Driver[];
};

export const getDriverById = async (driverId: string): Promise<Driver | null> => {
  const driverRef = doc(db, "drivers", driverId);
  const driverSnap = await getDoc(driverRef);
  
  if (driverSnap.exists()) {
    return { id: driverSnap.id, ...driverSnap.data() } as Driver;
  }
  return null;
};

// ==================== Change Requests ====================
export const createChangeRequest = async (
  changeRequest: Omit<ChangeRequest, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  const changeRequestsRef = collection(db, "changeRequests");
  const newRequest = {
    ...changeRequest,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(changeRequestsRef, newRequest);
  return docRef.id;
};

export const getChangeRequestsByStudentId = async (
  studentId: string
): Promise<ChangeRequest[]> => {
  const changeRequestsRef = collection(db, "changeRequests");
  const q = query(
    changeRequestsRef,
    where("studentId", "==", studentId),
    orderBy("requestedAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ChangeRequest[];
};

export const subscribeToChangeRequests = (
  studentId: string,
  callback: (changeRequests: ChangeRequest[]) => void
): (() => void) => {
  const changeRequestsRef = collection(db, "changeRequests");
  const q = query(
    changeRequestsRef,
    where("studentId", "==", studentId),
    orderBy("requestedAt", "desc")
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const changeRequests = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChangeRequest[];
    callback(changeRequests);
  });
};

// ==================== Students ====================
export const getStudentById = async (studentId: string): Promise<Student | null> => {
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Student;
  }
  return null;
};

export const getStudentByEmail = async (email: string): Promise<Student | null> => {
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Student;
  }
  return null;
};

export const updateStudent = async (
  studentId: string,
  updates: Partial<Student>
): Promise<void> => {
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const docRef = doc(db, "students", querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } else {
    throw new Error(`Student with studentId "${studentId}" not found`);
  }
};

/**
 * Update student by Firestore document ID (more direct and reliable)
 */
export const updateStudentByDocId = async (
  docId: string,
  updates: Partial<Student>
): Promise<void> => {
  const docRef = doc(db, "students", docId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const subscribeToStudent = (
  studentId: string,
  callback: (student: Student | null) => void
): (() => void) => {
  const studentsRef = collection(db, "students");
  const q = query(studentsRef, where("studentId", "==", studentId));
  
  return onSnapshot(q, (querySnapshot) => {
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      callback({ id: doc.id, ...doc.data() } as Student);
    } else {
      callback(null);
    }
  });
};

/**
 * Subscribe to student updates by Firestore document ID (more direct and reliable)
 */
export const subscribeToStudentByDocId = (
  docId: string,
  callback: (student: Student | null) => void
): (() => void) => {
  const docRef = doc(db, "students", docId);
  
  return onSnapshot(docRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback({ id: docSnapshot.id, ...docSnapshot.data() } as Student);
    } else {
      callback(null);
    }
  });
};
