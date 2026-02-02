# Live Bus Tracking - Implementation Guide

## Overview

This document describes the live bus tracking implementation using:
- **Frontend**: React (Vite) + react-leaflet
- **Maps**: OpenStreetMap + Leaflet (100% free)
- **Backend**: Firebase Realtime Database (RTDB)
- **Location Source**: Driver app

---

## 1. RTDB Schema for Bus Location

### Recommended Structure

```
/buses
  ├── BUS-001                          # Bus identifier
  │   ├── location                     # Current GPS data
  │   │   ├── latitude: 18.664536
  │   │   ├── longitude: 74.206378
  │   │   ├── accuracy: 15             # GPS accuracy in meters
  │   │   ├── speed: 8.5               # Speed in m/s
  │   │   ├── heading: 180             # Direction (0-360°)
  │   │   ├── altitude: 550            # Altitude in meters
  │   │   ├── busNumber: "MH14AB1234"
  │   │   ├── driverId: "driver-001"
  │   │   ├── driverName: "John Doe"
  │   │   ├── routeId: "route-1"
  │   │   ├── routeName: "Route A - North Campus"
  │   │   ├── routeState: "in_progress" # not_started | in_progress | completed
  │   │   ├── timestamp: 1706789012345 # Client timestamp
  │   │   └── updatedAt: 1706789012345 # Server timestamp
  │   │
  │   ├── routeState: "in_progress"    # Duplicate for quick access
  │   │
  │   ├── currentStop                  # Current/last stop info
  │   │   ├── stopId: "1-3"
  │   │   ├── name: "Railway Station"
  │   │   ├── order: 3
  │   │   ├── status: "current"
  │   │   └── updatedAt: 1706789010000
  │   │
  │   └── stops                        # All stops status
  │       ├── 1-1
  │       │   ├── id: "1-1"
  │       │   ├── name: "Sector 15 Market"
  │       │   ├── order: 1
  │       │   └── status: "reached"
  │       ├── 1-2
  │       │   ├── id: "1-2"
  │       │   ├── name: "Civil Lines"
  │       │   ├── order: 2
  │       │   └── status: "reached"
  │       └── 1-3
  │           ├── id: "1-3"
  │           ├── name: "Railway Station"
  │           ├── order: 3
  │           └── status: "current"
```

---

## 2. Driver App - Location Update Logic

### React Native / Expo Example

```typescript
import * as Location from 'expo-location';
import { ref, set, serverTimestamp } from 'firebase/database';
import { rtdb } from './firebase';

// Configuration
const LOCATION_UPDATE_INTERVAL = 5000; // 5 seconds
const LOCATION_ACCURACY = Location.Accuracy.High;
const MIN_DISTANCE_METERS = 10; // Minimum movement to trigger update

let locationSubscription: Location.LocationSubscription | null = null;

interface DriverSession {
  busId: string;
  busNumber: string;
  driverId: string;
  driverName: string;
  routeId: string;
  routeName: string;
}

export async function startLocationTracking(session: DriverSession) {
  // Request permissions
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }

  // Start watching location
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: LOCATION_ACCURACY,
      timeInterval: LOCATION_UPDATE_INTERVAL,
      distanceInterval: MIN_DISTANCE_METERS,
    },
    (location) => {
      updateBusLocation(session, location);
    }
  );
}

async function updateBusLocation(
  session: DriverSession,
  location: Location.LocationObject
) {
  const locationRef = ref(rtdb, `buses/${session.busId}/location`);
  
  await set(locationRef, {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    speed: location.coords.speed,
    heading: location.coords.heading,
    busNumber: session.busNumber,
    driverId: session.driverId,
    driverName: session.driverName,
    routeId: session.routeId,
    routeName: session.routeName,
    routeState: 'in_progress',
    timestamp: location.timestamp,
    updatedAt: Date.now(), // Or use serverTimestamp() for server time
  });
}

export function stopLocationTracking() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}

// Update route state
export async function updateRouteState(
  busId: string,
  state: 'not_started' | 'in_progress' | 'completed'
) {
  const busRef = ref(rtdb, `buses/${busId}`);
  await set(ref(rtdb, `buses/${busId}/routeState`), state);
  await set(ref(rtdb, `buses/${busId}/location/routeState`), state);
}
```

### Web (JavaScript) Example

```javascript
// For testing/demo purposes from web
async function startWebLocationTracking(session) {
  if (!navigator.geolocation) {
    throw new Error('Geolocation not supported');
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  };

  // Watch position continuously
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const locationRef = ref(rtdb, `buses/${session.busId}/location`);
      set(locationRef, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        busNumber: session.busNumber,
        driverId: session.driverId,
        driverName: session.driverName,
        routeId: session.routeId,
        routeName: session.routeName,
        routeState: 'in_progress',
        timestamp: position.timestamp,
        updatedAt: Date.now(),
      });
    },
    (error) => {
      console.error('Location error:', error);
    },
    options
  );

  return watchId;
}

function stopWebLocationTracking(watchId) {
  navigator.geolocation.clearWatch(watchId);
}
```

---

## 3. Student App - Real-time Subscription

### Already Implemented in `src/services/realtimeDb.ts`

```typescript
import { onValue, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export function subscribeToRealtimeBusByRouteId(
  routeId: string,
  onData: (data: RealtimeBusData | null) => void,
  onError?: (err: Error) => void
): () => void {
  const busesRef = ref(rtdb, 'buses');

  const unsubscribe = onValue(
    busesRef,
    (snap) => {
      const buses = snap.val();
      // Find bus matching student's route
      const match = findBusForRoute(buses, routeId);
      onData(match);
    },
    (err) => {
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}
```

---

## 4. LiveBusMap Component Usage

```tsx
import { LiveBusMap } from '@/components/LiveBusMap';

// In your component
<LiveBusMap
  busPosition={busPosition}           // { latitude, longitude, accuracy, timestamp }
  busNumber="MH14AB1234"
  driverName="John Doe"
  routeState="in_progress"            // not_started | in_progress | completed
  stops={stopMarkers}                 // Optional: array of stop markers
  studentStopId="1-3"                 // Optional: highlight student's stop
  height={300}                        // Map height in pixels
  autoCenter={false}                  // Auto-center on bus position
  showPath={true}                     // Show movement trail
  maxPathPoints={100}                 // Max points in trail
/>
```

---

## 5. Best Practices

### Battery & Network Optimization

1. **Throttle updates on driver app**:
   - Update every 5 seconds when moving
   - Update every 30 seconds when stationary
   - Use `distanceInterval` to skip updates if position unchanged

2. **Smart accuracy levels**:
   - High accuracy during active tracking
   - Lower accuracy when app backgrounded

3. **Batch writes**: Combine location + stop updates when possible

### Production Considerations

1. **RTDB Security Rules**:
```json
{
  "rules": {
    "buses": {
      "$busId": {
        ".read": "auth != null",
        ".write": "auth != null && data.child('driverId').val() === auth.uid"
      }
    }
  }
}
```

2. **Cleanup stale data**:
   - Use Cloud Functions to clean up locations older than 24 hours
   - Reset route state at midnight

3. **Error handling**:
   - Retry logic for failed updates
   - Offline queue for poor connectivity

4. **Monitoring**:
   - Track update frequency
   - Alert on buses not updating for > 5 minutes during route

---

## 6. File Structure

```
src/components/LiveBusMap/
├── index.ts              # Exports
├── types.ts              # TypeScript interfaces
├── LiveBusMap.tsx        # Main component
├── AnimatedBusMarker.tsx # Smooth-animated bus marker
├── PathTrail.tsx         # Movement history polyline
├── StopMarkers.tsx       # Stop markers on map
├── MapControls.tsx       # Center/path toggle buttons
└── LiveBusMap.css        # Styles
```

---

## 7. Testing the Map

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Simulate driver location** (in browser console):
   ```javascript
   import { ref, set } from 'firebase/database';
   import { rtdb } from './lib/firebase';

   // Simulate bus location update
   await set(ref(rtdb, 'buses/BUS-001/location'), {
     latitude: 18.5204,
     longitude: 73.8567,
     accuracy: 10,
     busNumber: 'MH14AB1234',
     driverName: 'Test Driver',
     routeId: 'route-1',
     routeName: 'Route A',
     routeState: 'in_progress',
     updatedAt: Date.now(),
   });
   ```

3. The map should show the bus marker and update in real-time!

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| Map not showing | Check if Leaflet CSS is imported |
| Bus marker not appearing | Verify RTDB path and data structure |
| Marker jumping instead of animating | Check `busPosition` is updating properly |
| Path not showing | Ensure `showPath={true}` and bus has moved |
| Console CORS errors | Check Firebase project configuration |

---

## Summary

This implementation provides:
- ✅ **100% free** OpenStreetMap tiles
- ✅ **Real-time** bus tracking via RTDB
- ✅ **Smooth animations** for bus marker
- ✅ **Path history** showing movement trail
- ✅ **Production-ready** code structure
- ✅ **Battery optimized** location updates
