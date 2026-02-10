import { useState, useEffect } from 'react';
import { Bell, Shield, CheckCircle2, ChevronRight, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission } from '@/services/fcm';

// Try to import native PushNotifications (only available on native)
let PushNotificationsNative: any = null;
if (Capacitor.isNativePlatform()) {
    import('@capacitor/push-notifications').then(mod => {
        PushNotificationsNative = mod.PushNotifications;
    });
}

interface PermissionItem {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    status: 'pending' | 'granted' | 'denied' | 'requesting';
    required: boolean;
}

interface PermissionsScreenProps {
    onComplete: () => void;
    studentName?: string;
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onComplete, studentName }) => {
    const isNative = Capacitor.isNativePlatform();

    const [permissions, setPermissions] = useState<PermissionItem[]>([
        {
            id: 'notifications',
            icon: <Bell className="w-6 h-6" />,
            title: 'Push Notifications',
            description: 'Get alerts when your bus starts, approaches your stop, and arrives.',
            status: 'pending',
            required: true,
        },
    ]);

    const [allHandled, setAllHandled] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Check existing permission status on mount
    useEffect(() => {
        const checkExistingPermissions = async () => {
            if (isNative) {
                // On native, check via Capacitor
                try {
                    const { PushNotifications } = await import('@capacitor/push-notifications');
                    const result = await PushNotifications.checkPermissions();
                    if (result.receive === 'granted') {
                        updatePermission('notifications', 'granted');
                    }
                } catch {
                    // Plugin not available
                }
            } else {
                // On web
                if (typeof window !== 'undefined' && 'Notification' in window) {
                    if (Notification.permission === 'granted') {
                        updatePermission('notifications', 'granted');
                    } else if (Notification.permission === 'denied') {
                        updatePermission('notifications', 'denied');
                    }
                }
            }
        };

        checkExistingPermissions();
    }, []);

    // Check if all permissions are handled
    useEffect(() => {
        const allDone = permissions.every(p => p.status === 'granted' || p.status === 'denied');
        setAllHandled(allDone);
    }, [permissions]);

    const updatePermission = (id: string, status: PermissionItem['status']) => {
        setPermissions(prev =>
            prev.map(p => (p.id === id ? { ...p, status } : p))
        );
    };

    const handleRequestAll = async () => {
        setIsProcessing(true);

        // Request notification permission
        const notifPerm = permissions.find(p => p.id === 'notifications');
        if (notifPerm && notifPerm.status === 'pending') {
            updatePermission('notifications', 'requesting');

            try {
                if (isNative) {
                    const { PushNotifications } = await import('@capacitor/push-notifications');
                    const result = await PushNotifications.requestPermissions();
                    updatePermission('notifications', result.receive === 'granted' ? 'granted' : 'denied');
                } else {
                    const permission = await requestNotificationPermission();
                    updatePermission('notifications', permission === 'granted' ? 'granted' : 'denied');
                }
            } catch {
                updatePermission('notifications', 'denied');
            }
        }

        setIsProcessing(false);
    };

    const grantedCount = permissions.filter(p => p.status === 'granted').length;
    const totalCount = permissions.length;

    const getStatusIcon = (status: PermissionItem['status']) => {
        switch (status) {
            case 'granted':
                return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'denied':
                return <Shield className="w-5 h-5 text-red-400" />;
            case 'requesting':
                return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
            default:
                return <ChevronRight className="w-5 h-5 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: PermissionItem['status']) => {
        switch (status) {
            case 'granted':
                return (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/15 text-emerald-500">
                        Allowed
                    </span>
                );
            case 'denied':
                return (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-500/15 text-red-400">
                        Denied
                    </span>
                );
            case 'requesting':
                return (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary/15 text-primary">
                        Requesting...
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                        Required
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header Section */}
            <div className="flex-1 flex flex-col px-6 pt-12 pb-6">
                {/* Welcome */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                        <Shield className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        Welcome{studentName ? `, ${studentName.split(' ')[0]}` : ''}! 👋
                    </h1>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                        To get the best experience, we need a few permissions. This helps us keep you updated about your bus.
                    </p>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="flex gap-1.5">
                        {permissions.map((p) => (
                            <div
                                key={p.id}
                                className={`w-8 h-1.5 rounded-full transition-all duration-500 ${p.status === 'granted'
                                        ? 'bg-emerald-500'
                                        : p.status === 'denied'
                                            ? 'bg-red-400'
                                            : 'bg-border'
                                    }`}
                            />
                        ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                        {grantedCount}/{totalCount}
                    </span>
                </div>

                {/* Permissions List */}
                <div className="space-y-3 animate-slide-up">
                    {permissions.map((perm) => (
                        <div
                            key={perm.id}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${perm.status === 'granted'
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : perm.status === 'denied'
                                        ? 'bg-red-500/5 border-red-500/20'
                                        : 'bg-card border-border'
                                }`}
                        >
                            {/* Icon */}
                            <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${perm.status === 'granted'
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : perm.status === 'denied'
                                            ? 'bg-red-500/10 text-red-400'
                                            : 'bg-primary/10 text-primary'
                                    }`}
                            >
                                {perm.icon}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="font-semibold text-foreground text-sm">{perm.title}</h3>
                                    {getStatusBadge(perm.status)}
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {perm.description}
                                </p>
                            </div>

                            {/* Status Icon */}
                            <div className="flex-shrink-0">
                                {getStatusIcon(perm.status)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
                    <div className="flex items-start gap-3">
                        <Smartphone className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground">Why these permissions?</span>
                                <br />
                                Notifications let us alert you when your bus starts, is approaching your stop, or has arrived. You can change these anytime in settings.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 pb-8 space-y-3">
                {!allHandled ? (
                    <>
                        <Button
                            onClick={handleRequestAll}
                            disabled={isProcessing}
                            className="w-full h-12 rounded-xl text-base font-semibold"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                <>
                                    <Shield className="w-5 h-5 mr-2" />
                                    Allow Permissions
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onComplete}
                            className="w-full h-10 rounded-xl text-sm text-muted-foreground"
                        >
                            Skip for now
                        </Button>
                    </>
                ) : (
                    <Button
                        onClick={onComplete}
                        className="w-full h-12 rounded-xl text-base font-semibold bg-emerald-600 hover:bg-emerald-700"
                    >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Continue to App
                    </Button>
                )}
            </div>
        </div>
    );
};
