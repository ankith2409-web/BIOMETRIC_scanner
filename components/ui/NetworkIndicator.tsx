import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Typography, FontSizes, BorderRadius } from '../../constants/theme';

interface NetworkIndicatorProps {
  isOnline?: boolean;
}

export default function NetworkIndicator({ isOnline = true }: NetworkIndicatorProps) {
  const pulseOpacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const pulseAnimStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value * 0.4,
    transform: [{ scale: pulseScale.value }],
  }));

  const dotColor = isOnline ? Colors.success : Colors.danger;
  const label = isOnline ? 'Online' : 'Offline';

  return (
    <View style={styles.container}>
      <View style={styles.dotContainer}>
        <Animated.View
          style={[
            styles.pulseRing,
            { backgroundColor: dotColor },
            pulseAnimStyle,
          ]}
        />
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </View>
      <Text style={[styles.label, { color: dotColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  dotContainer: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
