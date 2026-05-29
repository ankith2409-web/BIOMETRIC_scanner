import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Shadows, GlassStyles } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'accent' | 'success' | 'danger';
  padding?: number;
  borderRadius?: number;
  glow?: boolean;
}

export default function GlassCard({
  children,
  style,
  variant = 'default',
  padding = 16,
  borderRadius = BorderRadius.lg,
  glow = false,
}: GlassCardProps) {
  const borderColor = {
    default: Colors.glassBorder,
    accent: Colors.borderAccent,
    success: Colors.borderSuccess,
    danger: Colors.borderDanger,
  }[variant];

  const shadowStyle = variant === 'accent' ? Shadows.cardGlow : Shadows.card;

  const shimmerPos = useSharedValue(-1);

  useEffect(() => {
    if (glow) {
      shimmerPos.value = withRepeat(
        withTiming(2, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [glow]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerPos.value * 150 }],
    opacity: 0.6,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          padding,
          borderRadius,
          borderColor,
        },
        shadowStyle,
        style,
      ]}
    >
      {glow && (
        <Animated.View style={[styles.shimmerContainer, { borderRadius }]}>
          <Animated.View style={[styles.shimmerLine, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(0, 212, 255, 0.15)', 'rgba(124, 92, 252, 0.1)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        </Animated.View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    overflow: 'hidden',
  },
  shimmerLine: {
    position: 'absolute',
    top: 0,
    left: -100,
    width: 200,
    height: '100%',
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },
});
