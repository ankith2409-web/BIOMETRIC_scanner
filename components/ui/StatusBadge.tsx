import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Typography, FontSizes } from '../../constants/theme';

type BadgeVariant = 'success' | 'danger' | 'pending' | 'offline' | 'info';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  size?: 'sm' | 'md';
  pulsing?: boolean;
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string; icon: string; defaultIcon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  success: {
    bg: Colors.successDim,
    text: Colors.success,
    icon: Colors.success,
    defaultIcon: 'check-circle',
  },
  danger: {
    bg: Colors.dangerDim,
    text: Colors.danger,
    icon: Colors.danger,
    defaultIcon: 'alert-circle',
  },
  pending: {
    bg: Colors.warningDim,
    text: Colors.warning,
    icon: Colors.warning,
    defaultIcon: 'clock-outline',
  },
  offline: {
    bg: Colors.dangerDim,
    text: Colors.danger,
    icon: Colors.danger,
    defaultIcon: 'wifi-off',
  },
  info: {
    bg: Colors.accentDim,
    text: Colors.accent,
    icon: Colors.accent,
    defaultIcon: 'information',
  },
};

export default function StatusBadge({ label, variant = 'info', icon, size = 'sm', pulsing = false }: StatusBadgeProps) {
  const config = variantConfig[variant];
  const iconName = icon || config.defaultIcon;
  const isSmall = size === 'sm';

  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (pulsing) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [pulsing]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.8 }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: config.bg }, isSmall ? styles.small : styles.medium]}>
      {pulsing ? (
        <View style={styles.dotContainer}>
          <View style={[styles.dotCore, { backgroundColor: config.icon }]} />
          <Animated.View style={[styles.dotRing, { borderColor: config.icon }, pulseStyle]} />
        </View>
      ) : (
        <MaterialCommunityIcons
          name={iconName}
          size={isSmall ? 12 : 14}
          color={config.icon}
        />
      )}
      <Text style={[styles.label, { color: config.text }, isSmall ? styles.labelSmall : styles.labelMedium]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    ...Typography.bodySemiBold,
    letterSpacing: 0.2,
  },
  labelSmall: {
    fontSize: FontSizes.xs,
  },
  labelMedium: {
    fontSize: FontSizes.sm,
  },
  dotContainer: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
  },
  dotRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    position: 'absolute',
  },
});

