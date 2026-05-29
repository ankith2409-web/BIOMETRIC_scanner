import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Ellipse, Line, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  FadeInUp,
  SlideInDown,
} from 'react-native-reanimated';
import AnimatedButton from '../components/ui/AnimatedButton';
import { Colors, Typography, FontSizes, Shadows } from '../constants/theme';
import { modelLoader } from '../src/engine/modelLoader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedLine = Animated.createAnimatedComponent(Line);

function FaceScanLogo() {
  const scanLineY = useSharedValue(80);
  const glowOpacity = useSharedValue(0.3);
  const ovalOpacity = useSharedValue(0);

  useEffect(() => {
    ovalOpacity.value = withTiming(1, { duration: 1000 });
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(200, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(80, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const scanLineProps = useAnimatedProps(() => ({
    y1: scanLineY.value,
    y2: scanLineY.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
  }));

  const ovalAnimStyle = useAnimatedProps(() => ({
    opacity: ovalOpacity.value,
  }));

  return (
    <View style={styles.logoContainer}>
      <Svg width={160} height={200} viewBox="0 0 160 200">
        {/* Outer glow */}
        <AnimatedEllipse
          cx={80}
          cy={130}
          rx={56}
          ry={72}
          stroke={Colors.accent}
          strokeWidth={8}
          fill="none"
          animatedProps={glowProps}
        />
        {/* Main oval */}
        <AnimatedEllipse
          cx={80}
          cy={130}
          rx={50}
          ry={66}
          stroke={Colors.accent}
          strokeWidth={2}
          strokeDasharray="8 6"
          fill="none"
          animatedProps={ovalAnimStyle}
        />
        {/* Corner brackets - top-left */}
        <Line x1={24} y1={58} x2={24} y2={78} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={24} y1={58} x2={44} y2={58} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        {/* Corner brackets - top-right */}
        <Line x1={136} y1={58} x2={136} y2={78} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={136} y1={58} x2={116} y2={58} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        {/* Corner brackets - bottom-left */}
        <Line x1={24} y1={202} x2={24} y2={182} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={24} y1={202} x2={44} y2={202} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        {/* Corner brackets - bottom-right */}
        <Line x1={136} y1={202} x2={136} y2={182} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={136} y1={202} x2={116} y2={202} stroke={Colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        {/* Scan line */}
        <AnimatedLine
          x1={35}
          x2={125}
          stroke={Colors.accent}
          strokeWidth={2}
          opacity={0.6}
          animatedProps={scanLineProps}
        />
        {/* Face dots */}
        {/* Eyes */}
        <Circle cx={62} cy={115} r={3} fill={Colors.accent} opacity={0.7} />
        <Circle cx={98} cy={115} r={3} fill={Colors.accent} opacity={0.7} />
        {/* Nose */}
        <Circle cx={80} cy={138} r={2} fill={Colors.accent} opacity={0.5} />
        {/* Mouth */}
        <Line x1={68} y1={155} x2={92} y2={155} stroke={Colors.accent} strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
      </Svg>
    </View>
  );
}

function FloatingParticle({ delay, x, y, size = 3 }: { delay: number; x: number; y: number; size?: number }) {
  const opacity = useSharedValue(0.1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-60, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    />
  );
}

export default function SplashScreen() {
  const router = useRouter();
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatus, setLoadStatus] = useState('Initializing FaceGate...');

  const progressWidth = useSharedValue(0);

  useEffect(() => {
    modelLoader
      .loadAll((step, total, label) => {
        const progress = Math.round((step / total) * 100);
        setLoadProgress(progress);
        setLoadStatus(`${label} (${step}/${total})`);
        progressWidth.value = withTiming(progress, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      })
      .then(() => {
        setLoadProgress(100);
        setLoadStatus('Ready!');
        progressWidth.value = withTiming(100, { duration: 250 });
        setTimeout(() => setModelsLoaded(true), 250);
      })
      .catch((error) => {
        console.error('Failed to load models at splash:', error);
        setLoadStatus('Model load failed. Tap Get Started to retry in-app.');
        setModelsLoaded(true);
      });
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handleGetStarted = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#0A0F1E', '#0D1B3E', '#0A0F1E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Ambient particles/grid lines */}
      <View style={styles.gridOverlay}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={`h${i}`}
            style={[
              styles.gridLine,
              { top: `${(i + 1) * 14}%`, width: '100%', height: 1 },
            ]}
          />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={`v${i}`}
            style={[
              styles.gridLine,
              { left: `${(i + 1) * 20}%`, height: '100%', width: 1 },
            ]}
          />
        ))}
      </View>

      {/* Floating Background Particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingParticle delay={0} x={SCREEN_WIDTH * 0.15} y={SCREEN_HEIGHT * 0.25} size={3} />
        <FloatingParticle delay={1200} x={SCREEN_WIDTH * 0.75} y={SCREEN_HEIGHT * 0.15} size={4} />
        <FloatingParticle delay={600} x={SCREEN_WIDTH * 0.35} y={SCREEN_HEIGHT * 0.55} size={3} />
        <FloatingParticle delay={1800} x={SCREEN_WIDTH * 0.8} y={SCREEN_HEIGHT * 0.7} size={5} />
        <FloatingParticle delay={2400} x={SCREEN_WIDTH * 0.1} y={SCREEN_HEIGHT * 0.8} size={3} />
        <FloatingParticle delay={900} x={SCREEN_WIDTH * 0.6} y={SCREEN_HEIGHT * 0.4} size={4} />
        <FloatingParticle delay={1500} x={SCREEN_WIDTH * 0.2} y={SCREEN_HEIGHT * 0.1} size={3} />
      </View>

      <View style={styles.content}>
        {/* Logo */}
        <FaceScanLogo />

        {/* App name */}
        <Animated.Text
          entering={FadeInUp.delay(200).duration(800)}
          style={styles.appName}
        >
          FaceGate
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          entering={FadeInUp.delay(400).duration(800)}
          style={styles.tagline}
        >
          Secure. Offline. Instant.
        </Animated.Text>

        {/* Loading section */}
        <Animated.View
          entering={FadeIn.delay(600).duration(600)}
          style={styles.loadingSection}
        >
          <Text style={styles.loadStatus}>{loadStatus}</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          <Text style={styles.progressText}>{loadProgress}%</Text>
        </Animated.View>

        {/* CTA */}
        {modelsLoaded && (
          <Animated.View
            entering={FadeInUp.duration(600).springify()}
            style={styles.ctaContainer}
          >
            <AnimatedButton
              label="Get Started"
              onPress={handleGetStarted}
              icon="arrow-right"
              size="lg"
            />
          </Animated.View>
        )}
      </View>

      {/* Version */}
      <Animated.Text
        entering={FadeIn.delay(800).duration(600)}
        style={styles.version}
      >
        v1.0.0 • TFLite Runtime
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gridOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.03,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: Colors.accent,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  appName: {
    ...Typography.heading,
    fontSize: 42,
    color: Colors.textPrimary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  tagline: {
    ...Typography.body,
    fontSize: FontSizes.lg,
    color: Colors.accent,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginTop: 8,
    opacity: 0.8,
  },
  loadingSection: {
    width: '100%',
    marginTop: 48,
    alignItems: 'center',
  },
  loadStatus: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  progressTrack: {
    width: '80%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
    ...Shadows.glow(Colors.accent),
  },
  progressText: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  ctaContainer: {
    marginTop: 40,
    width: '100%',
  },
  version: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingBottom: 30,
    letterSpacing: 1,
  },
  particle: {
    position: 'absolute',
    backgroundColor: Colors.accent,
  },
});
