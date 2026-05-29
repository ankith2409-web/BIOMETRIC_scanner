import React, { useEffect } from 'react';
import { Text, StyleSheet, Pressable, ViewStyle, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Typography, FontSizes, Shadows } from '../../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'ghost';
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

const gradients: Record<string, [string, string]> = {
  primary: ['#00D4FF', '#0099CC'],
  success: ['#00FF88', '#00CC6A'],
  danger: ['#FF3B5C', '#CC2E4A'],
};

export default function AnimatedButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  size = 'md',
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);
  const sweepX = useSharedValue(-200);

  useEffect(() => {
    if (!disabled && variant !== 'ghost') {
      sweepX.value = withDelay(
        300,
        withTiming(400, { duration: 800, easing: Easing.out(Easing.cubic) })
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepX.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const paddingVertical = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? FontSizes.sm : size === 'lg' ? FontSizes.lg : FontSizes.md;
  const isGhost = variant === 'ghost';

  if (isGhost) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[animatedStyle, styles.ghostButton, { paddingVertical }, style]}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={size === 'sm' ? 16 : 20}
            color={Colors.accent}
          />
        )}
        <Text style={[styles.ghostLabel, { fontSize }]}>{label}</Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[animatedStyle, { opacity: disabled ? 0.5 : 1 }, style]}
    >
      <LinearGradient
        colors={gradients[variant] || gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, { paddingVertical, borderRadius: BorderRadius.md }]}
      >
        {/* Sweep shimmer overlay */}
        <Animated.View style={[styles.sweepOverlay, sweepStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.25)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sweepGradient}
          />
        </Animated.View>

        {loading ? (
          <ActivityIndicator size="small" color={Colors.background} />
        ) : (
          <>
            {icon && (
              <MaterialCommunityIcons
                name={icon}
                size={size === 'sm' ? 16 : 20}
                color={Colors.background}
              />
            )}
            <Text style={[styles.label, { fontSize }]}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  label: {
    ...Typography.bodySemiBold,
    color: Colors.background,
    letterSpacing: 0.3,
  },
  sweepOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: '100%',
  },
  sweepGradient: {
    width: '100%',
    height: '100%',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.accentDim,
  },
  ghostLabel: {
    ...Typography.bodySemiBold,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
});
