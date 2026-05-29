import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface FaceOvalGuideProps {
  detected?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export default function FaceOvalGuide({
  detected = false,
  width = 240,
  height = 320,
  x,
  y,
}: FaceOvalGuideProps) {
  const strokeDashOffset = useSharedValue(600);
  const glowOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (detected) {
      // Fill the dashed border when face is detected
      strokeDashOffset.value = withTiming(0, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      });
      glowOpacity.value = withTiming(0.6, { duration: 800 });
    } else {
      strokeDashOffset.value = withRepeat(
        withSequence(
          withTiming(500, { duration: 2000, easing: Easing.linear }),
          withTiming(600, { duration: 0 })
        ),
        -1
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [detected]);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const strokeColor = detected ? Colors.success : Colors.accent;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeDashOffset.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
  }));

  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 - 8;
  const ry = height / 2 - 8;

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          position: 'absolute',
          left: x !== undefined ? x : '50%',
          top: y !== undefined ? y : '50%',
          marginLeft: x !== undefined ? 0 : -width / 2,
          marginTop: y !== undefined ? 0 : -height / 2,
        },
      ]}
    >
      <Svg width={width} height={height}>
        {/* Glow ellipse */}
        <AnimatedEllipse
          cx={cx}
          cy={cy}
          rx={rx + 4}
          ry={ry + 4}
          stroke={strokeColor}
          strokeWidth={8}
          fill="none"
          animatedProps={glowProps}
        />
        {/* Main dashed ellipse */}
        <AnimatedEllipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeDasharray="12 8"
          fill="none"
          animatedProps={animatedProps}
        />
        {/* Corner markers */}
        {/* Top */}
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={strokeColor}
          strokeWidth={3}
          strokeDasharray="20 580"
          fill="none"
          opacity={0.8}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
