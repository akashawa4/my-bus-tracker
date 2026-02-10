import { useState } from 'react';
import { StudentProvider, useStudent } from '@/context/StudentContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { PermissionsScreen } from '@/screens/PermissionsScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { TrackingScreen } from '@/screens/TrackingScreen';

const PERMISSIONS_KEY = 'bus_tracker_permissions_shown';

const AppContent: React.FC = () => {
  const { isLoggedIn, student } = useStudent();

  // Track if permissions screen has been shown this session
  const [permissionsHandled, setPermissionsHandled] = useState(() => {
    try {
      return localStorage.getItem(PERMISSIONS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handlePermissionsComplete = () => {
    setPermissionsHandled(true);
    try {
      localStorage.setItem(PERMISSIONS_KEY, 'true');
    } catch {
      // ignore
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Show permissions screen after login (only once)
  if (!permissionsHandled) {
    return (
      <PermissionsScreen
        onComplete={handlePermissionsComplete}
        studentName={student?.name}
      />
    );
  }

  if (!student?.hasCompletedSetup) {
    return <SetupScreen />;
  }

  return <TrackingScreen />;
};

const Index = () => {
  return (
    <StudentProvider>
      <div className="min-h-screen-safe bg-background">
        <AppContent />
      </div>
    </StudentProvider>
  );
};

export default Index;
