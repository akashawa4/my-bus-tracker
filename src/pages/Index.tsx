import { StudentProvider, useStudent } from '@/context/StudentContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { TrackingScreen } from '@/screens/TrackingScreen';

const AppContent: React.FC = () => {
  const { isLoggedIn, student } = useStudent();

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  if (!student?.hasCompletedSetup) {
    return <SetupScreen />;
  }

  return <TrackingScreen />;
};

const Index = () => {
  return (
    <StudentProvider>
      <div className="min-h-screen bg-background">
        <AppContent />
      </div>
    </StudentProvider>
  );
};

export default Index;
