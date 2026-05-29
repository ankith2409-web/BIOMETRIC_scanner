import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

interface ScanRingProps {
  size?: number;
  processing?: boolean;
  success?: boolean;
  failure?: boolean;
}

export default function ScanRing({
  size = 280,
  processing = true,
  success = false,
  failure = false,
}: ScanRingProps) {
  const rotation = useSharedValue(0);
  const arcOpacity = useSharedValue(0.8);

  useEffect(() => {
    if (processing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false
      );
      arcOpacity.value = withRepeat(
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [processing]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const center = size / 2;
  const radius = size / 2 - 10;

  let ringColor: string = Colors.accent;
  if (success) ringColor = Colors.success;
  if (failure) ringColor = Colors.danger;

  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.25; // 90-degree arc

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer glow ring */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radius + 6}
          stroke={ringColor}
          strokeWidth={1}
          fill="none"
          opacity={0.15}
        />
        {/* Static background ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={2}
          fill="none"
          opacity={0.15}
          strokeDasharray="4 4"
        />
      </Svg>

      {/* Rotating arc */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <Svg width={size} height={size}>
          {/* Primary arc */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={ringColor}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
            opacity={0.9}
          />
          {/* Secondary arc (opposite) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={ringColor}
            strokeWidth={2}
            fill="none"
            strokeDasharray={`${arcLength * 0.5} ${circumference - arcLength * 0.5}`}
            strokeDashoffset={circumference * 0.5}
            strokeLinecap="round"
            opacity={0.5}
          />
        </Svg>
      </Animated.View>

      {/* Success/Failure full ring */}
      {(success || failure) && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={ringColor}
            strokeWidth={3}
            fill="none"
            opacity={0.6}
          />
          <Circle
            cx={center}
            cy={center}
            r={radius + 12}
            stroke={ringColor}
            strokeWidth={1}
            fill="none"
            opacity={0.2}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
