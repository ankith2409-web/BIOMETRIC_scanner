import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';

interface IndianFlagProps {
  width?: number;
  height?: number;
  style?: any;
}

export default function IndianFlag({
  width = 24,
  height = 16,
  style,
}: IndianFlagProps) {
  const stripeHeight = height / 3;

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 24 16">
        {/* Saffron band */}
        <Rect x="0" y="0" width="24" height={5.33} fill="#FF9933" />
        {/* White band */}
        <Rect x="0" y="5.33" width="24" height={5.34} fill="#FFFFFF" />
        {/* Green band */}
        <Rect x="0" y="10.67" width="24" height={5.33} fill="#128807" />
        {/* Ashok Chakra (Navy Blue Wheel) */}
        <Circle
          cx="12"
          cy="8"
          r="1.8"
          stroke="#000080"
          strokeWidth="0.4"
          fill="none"
        />
        <Circle cx="12" cy="8" r="0.5" fill="#000080" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});
