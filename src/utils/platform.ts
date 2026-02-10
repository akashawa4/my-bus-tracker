import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running on a native platform (iOS or Android)
 */
export const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = () => {
    return Capacitor.getPlatform();
};

/**
 * Check if running on Android
 */
export const isAndroid = () => {
    return Capacitor.getPlatform() === 'android';
};

/**
 * Check if running on iOS
 */
export const isIOS = () => {
    return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if running on web
 */
export const isWeb = () => {
    return Capacitor.getPlatform() === 'web';
};
