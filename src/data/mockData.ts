import { Route, Student } from '@/types/student';

export const mockRoutes: Route[] = [
  {
    id: 'route-1',
    name: 'Route A - Downtown',
    description: 'Via Main Street and Central Avenue',
    stops: [
      { id: 'stop-1-1', name: 'Central Station', order: 1, estimatedTime: '7:30 AM' },
      { id: 'stop-1-2', name: 'Main Street', order: 2, estimatedTime: '7:38 AM' },
      { id: 'stop-1-3', name: 'Park Avenue', order: 3, estimatedTime: '7:45 AM' },
      { id: 'stop-1-4', name: 'Oak Hill', order: 4, estimatedTime: '7:52 AM' },
      { id: 'stop-1-5', name: 'Riverside Drive', order: 5, estimatedTime: '8:00 AM' },
      { id: 'stop-1-6', name: 'School Campus', order: 6, estimatedTime: '8:10 AM' },
    ],
  },
  {
    id: 'route-2',
    name: 'Route B - Suburbs',
    description: 'Via Highway 101 and Maple Lane',
    stops: [
      { id: 'stop-2-1', name: 'Greenwood Estate', order: 1, estimatedTime: '7:20 AM' },
      { id: 'stop-2-2', name: 'Maple Lane', order: 2, estimatedTime: '7:30 AM' },
      { id: 'stop-2-3', name: 'Sunset Boulevard', order: 3, estimatedTime: '7:40 AM' },
      { id: 'stop-2-4', name: 'Valley View', order: 4, estimatedTime: '7:50 AM' },
      { id: 'stop-2-5', name: 'School Campus', order: 5, estimatedTime: '8:05 AM' },
    ],
  },
  {
    id: 'route-3',
    name: 'Route C - Eastside',
    description: 'Via Harbor Road and Beach Street',
    stops: [
      { id: 'stop-3-1', name: 'Harbor Junction', order: 1, estimatedTime: '7:15 AM' },
      { id: 'stop-3-2', name: 'Beach Street', order: 2, estimatedTime: '7:25 AM' },
      { id: 'stop-3-3', name: 'Marina Bay', order: 3, estimatedTime: '7:35 AM' },
      { id: 'stop-3-4', name: 'Eastgate Mall', order: 4, estimatedTime: '7:48 AM' },
      { id: 'stop-3-5', name: 'Pine Grove', order: 5, estimatedTime: '7:55 AM' },
      { id: 'stop-3-6', name: 'Cedar Heights', order: 6, estimatedTime: '8:02 AM' },
      { id: 'stop-3-7', name: 'School Campus', order: 7, estimatedTime: '8:15 AM' },
    ],
  },
];

export const mockStudent: Student = {
  id: 'student-1',
  name: 'Alex Johnson',
  email: 'alex.johnson@school.edu',
  hasCompletedSetup: false,
};
