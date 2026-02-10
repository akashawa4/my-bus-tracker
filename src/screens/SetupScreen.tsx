import { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { Button } from '@/components/ui/button';
import { RouteCard } from '@/components/RouteCard';
import { StopSelectCard } from '@/components/StopSelectCard';
import { ArrowLeft, ArrowRight, Check, MapPin, Bus } from 'lucide-react';

type SetupStep = 'route' | 'stop' | 'confirm';

export const SetupScreen: React.FC = () => {
  const { student, routes, selectedRoute, selectRoute, selectStop, confirmSelection } = useStudent();
  const [step, setStep] = useState<SetupStep>('route');

  const handleRouteSelect = (routeId: string) => {
    selectRoute(routeId);
  };

  const handleStopSelect = (stopId: string) => {
    selectStop(stopId);
  };

  const handleNext = () => {
    if (step === 'route' && selectedRoute) {
      setStep('stop');
    } else if (step === 'stop' && student?.selectedStopId) {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'stop') {
      setStep('route');
    } else if (step === 'confirm') {
      setStep('stop');
    }
  };

  const handleConfirm = () => {
    confirmSelection();
  };

  const selectedStop = selectedRoute?.stops.find(s => s.id === student?.selectedStopId);

  return (
    <div className="min-h-screen-safe bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {step !== 'route' && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {step === 'route' && 'Select Your Route'}
              {step === 'stop' && 'Select Your Stop'}
              {step === 'confirm' && 'Confirm Selection'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 'route' && 'Choose the bus route you take'}
              {step === 'stop' && 'Choose where you board the bus'}
              {step === 'confirm' && 'Review your selection'}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2 mt-4">
          {['route', 'stop', 'confirm'].map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= ['route', 'stop', 'confirm'].indexOf(step)
                  ? 'bg-primary'
                  : 'bg-border'
                }`}
            />
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        {step === 'route' && (
          <div className="space-y-3 animate-fade-in">
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={selectedRoute?.id === route.id}
                onSelect={() => handleRouteSelect(route.id)}
              />
            ))}
          </div>
        )}

        {step === 'stop' && selectedRoute && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-muted-foreground mb-4">
              Stops on <span className="font-medium text-foreground">{selectedRoute.name}</span>
            </p>
            {selectedRoute.stops.map((stop) => (
              <StopSelectCard
                key={stop.id}
                stop={stop}
                isSelected={student?.selectedStopId === stop.id}
                onSelect={() => handleStopSelect(stop.id)}
              />
            ))}
          </div>
        )}

        {step === 'confirm' && selectedRoute && selectedStop && (
          <div className="animate-slide-up">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 mx-auto mb-4">
                <Check className="w-8 h-8 text-success" />
              </div>

              <h2 className="text-xl font-semibold text-center text-foreground mb-6">
                Ready to go!
              </h2>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Route</p>
                    <p className="font-semibold text-foreground">{selectedRoute.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Stop</p>
                    <p className="font-semibold text-foreground">{selectedStop.name}</p>
                    {selectedStop.estimatedTime && (
                      <p className="text-sm text-muted-foreground">{selectedStop.estimatedTime}</p>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center mt-6">
                You'll receive notifications when the bus starts and when it reaches your stop.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border p-4 sticky bottom-0">
        {step !== 'confirm' ? (
          <Button
            onClick={handleNext}
            disabled={
              (step === 'route' && !selectedRoute) ||
              (step === 'stop' && !student?.selectedStopId)
            }
            className="w-full h-12 rounded-xl text-base font-semibold"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleConfirm}
            className="w-full h-12 rounded-xl text-base font-semibold bg-success hover:bg-success/90"
          >
            <Check className="w-5 h-5 mr-2" />
            Confirm Selection
          </Button>
        )}
      </footer>
    </div>
  );
};
