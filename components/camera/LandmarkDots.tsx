import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface LandmarkDotsProps {
  visible?: boolean;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
}

export default function LandmarkDots({
  visible = false,
  width = 280,
  height = 370,
  points,
}: LandmarkDotsProps) {
  if (!visible || !points || points.length === 0) return null;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {points.map((pt, idx) => (
          <Circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={1.8}
            fill="#00FF88"
            opacity={0.8}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
});
