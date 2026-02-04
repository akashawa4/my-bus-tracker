import { useCallback, useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { createChangeRequest } from '@/services/firestore';
import { Timestamp } from 'firebase/firestore';

export const useChangeRequest = () => {
  const { student, selectedRoute } = useStudent();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitChangeRequest = useCallback(
    async (
      requestedRouteId: string,
      requestedStopId: string,
      requestedRouteName: string,
      requestedStopName: string
    ) => {
      if (!student || !selectedRoute) {
        setError('Student or route information is missing');
        return false;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const currentStop = selectedRoute.stops.find(
          (stop) => stop.id === student.selectedStopId
        );

        await createChangeRequest({
          studentId: student.studentId || student.id, // Use studentId if available, fallback to document id
          studentName: student.name,
          currentRoute: selectedRoute.name,
          currentStop: currentStop?.name || '',
          requestedRoute: requestedRouteName,
          requestedStop: requestedStopName,
          status: 'pending',
          requestedAt: Timestamp.now(),
        });

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit change request');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [student, selectedRoute]
  );

  return {
    submitChangeRequest,
    isSubmitting,
    error,
  };
};
