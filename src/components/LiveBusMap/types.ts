/**
 * Types for the LiveBusMap component
 */

export interface BusPosition {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    timestamp: number;
}

export interface StopMarker {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    status: 'pending' | 'current' | 'reached';
    isStudentStop?: boolean;
}

export interface LiveBusMapProps {
    /** Current bus position from RTDB */
    busPosition: BusPosition | null;
    /** Bus number for display */
    busNumber?: string;
    /** Driver name for display */
    driverName?: string;
    /** Route state: not_started, in_progress, completed */
    routeState?: string;
    /** Optional: Stop markers to show on map */
    stops?: StopMarker[];
    /** Optional: Student's stop ID for highlighting */
    studentStopId?: string;
    /** Height of the map container */
    height?: string | number;
    /** Whether to auto-center on bus */
    autoCenter?: boolean;
    /** Show path trail of bus movement */
    showPath?: boolean;
    /** Maximum points to keep in path history */
    maxPathPoints?: number;
    /** Callback when map is clicked */
    onMapClick?: (lat: number, lng: number) => void;
}

export interface MapControlsProps {
    onCenterBus: () => void;
    onTogglePath: () => void;
    showPath: boolean;
    isTracking: boolean;
}
