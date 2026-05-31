import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors, Typography, FontSizes, BorderRadius } from '../../constants/theme';
import { storageService } from '../../services/storageService';
import { sqliteService } from '../../services/sqliteService';

type NetStatus = 'online' | 'offline' | 'syncing' | 'synced';

export default function OfflineBanner() {
  // null = not yet determined (first probe hasn't returned yet)
  const [status, setStatus] = useState<NetStatus | null>(null);
  const [visible, setVisible] = useState(false);
  
  const translateY = useSharedValue(-100);
  const iconPulse = useSharedValue(1);

  // Subscribe to storageService sync callback
  useEffect(() => {
    const unsubscribe = storageService.onSyncSuccess(() => {
      setStatus('synced');
      setVisible(true);
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          setStatus('online');
        }, 300);
      }, 3000);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cross-platform network check
  useEffect(() => {
    // Use a ref-style variable so closure always reads the latest value.
    // Starts as null — means "unknown, haven't probed yet".
    let prevOnline: boolean | null = null;

    const checkConnectivity = async () => {
      const isOnline = await storageService.checkOnlineStatus();
      handleStatusChange(isOnline);
    };

    const handleStatusChange = (isOnline: boolean) => {
      // First probe: just record baseline, show nothing
      if (prevOnline === null) {
        prevOnline = isOnline;
        if (!isOnline) {
          // Start offline — show banner immediately
          setStatus('offline');
          setVisible(true);
        } else {
          setStatus('online');
          // Don't show the banner on startup just because we're online
        }
        return;
      }

      if (isOnline === prevOnline) return;
      prevOnline = isOnline;

      if (isOnline) {
        // Returned Online: transition status to syncing and trigger database sync
        setStatus('syncing');
        setVisible(true);
        triggerAutoSync();
      } else {
        // Went Offline
        setStatus('offline');
        setVisible(true);
      }
    };

    const triggerAutoSync = async () => {
      const localLogs = storageService.getLogs();
      const attendanceRecords = storageService.getAttendanceRecords();

      if (localLogs.length === 0 && attendanceRecords.length === 0) {
        setTimeout(() => {
          setVisible(false);
          setStatus('online');
        }, 1500);
        return;
      }

      await storageService.autoSyncIfOnline();
    };

    // Run initial probe immediately
    checkConnectivity();

    // On web, browser fires online/offline events quickly
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const goOnline = () => checkConnectivity();
      const goOffline = () => handleStatusChange(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);

      // Still poll every 6 s as a safety net
      const pollingId = setInterval(checkConnectivity, 6000);

      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
        clearInterval(pollingId);
      };
    }

    // Native: poll every 6 seconds
    const pollingId = setInterval(checkConnectivity, 6000);
    return () => clearInterval(pollingId);
  }, []);

  // Animating the sliding banner view
  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
      iconPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 450 }),
          withTiming(1.0, { duration: 450 })
        ),
        -1,
        true
      );
    } else {
      translateY.value = withTiming(-100, { duration: 300 });
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  if (status === null || (status === 'online' && !visible)) return null;

  const isOffline = status === 'offline';
  const isSynced = status === 'synced';
  const isSyncing = status === 'syncing';

  const bannerBg = isOffline 
    ? Colors.warningDim 
    : isSynced 
    ? Colors.successDim 
    : 'rgba(0, 212, 255, 0.12)';

  const bannerBorder = isOffline 
    ? 'rgba(255, 184, 0, 0.18)' 
    : isSynced 
    ? Colors.borderSuccess 
    : Colors.borderAccent;

  const bannerText = isOffline 
    ? Colors.warning 
    : isSynced 
    ? Colors.success 
    : Colors.accent;

  const bannerIcon = isOffline 
    ? 'wifi-off' as const 
    : isSynced 
    ? 'check-circle' as const 
    : 'wifi' as const;

  const message = isOffline 
    ? "Device is offline. Running in secure offline-mode."
    : isSynced 
    ? "Data successfully synced and purged to cloud!"
    : "Connection restored. Syncing & purging local database...";

  return (
    <Animated.View style={[styles.container, containerStyle, { backgroundColor: bannerBg, borderBottomColor: bannerBorder }]}>
      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <MaterialCommunityIcons name={bannerIcon} size={16} color={bannerText} />
      </Animated.View>
      <Text style={[styles.text, { color: bannerText }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 54 : 36, // accommodates native status bar height
    zIndex: 999999, // ensures it overlays the navigation headers
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.xs,
    flex: 1,
  },
});
