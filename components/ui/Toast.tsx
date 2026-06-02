import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, runOnJS } from 'react-native-reanimated';
import { Colors, Typography, FontSizes, BorderRadius, Shadows } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      runOnJS(onClose)();
    }, duration);
    return () => clearTimeout(timer);
  }, [message]);

  const getColors = () => {
    switch (type) {
      case 'success': return { bg: 'rgba(0, 255, 136, 0.9)', text: '#0A0F1E', border: '#00FF88' };
      case 'error': return { bg: 'rgba(255, 68, 68, 0.9)', text: '#FFFFFF', border: '#FF4444' };
      default: return { bg: 'rgba(10, 15, 30, 0.9)', text: Colors.textPrimary, border: Colors.accent };
    }
  };

  const colors = getColors();

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      exiting={FadeOutDown.duration(400)}
      style={styles.container}
    >
      <View style={[styles.toast, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: 20,
  },
  toast: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow('rgba(0, 0, 0, 0.3)'),
  },
  text: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
});
