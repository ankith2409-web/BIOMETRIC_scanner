import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Typography, FontSizes, Shadows } from '../../constants/theme';

interface LivenessPromptProps {
  prompt: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  visible?: boolean;
}

export default function LivenessPrompt({
  prompt,
  icon = 'eye-outline',
  visible = true,
}: LivenessPromptProps) {
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0);
  const iconPulse = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 400 });
      iconPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      translateY.value = withTiming(50, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.card}>
        <Animated.View style={[styles.iconContainer, iconStyle]}>
          <MaterialCommunityIcons name={icon} size={24} color={Colors.accent} />
        </Animated.View>
        <Text style={styles.prompt}>{prompt}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...Shadows.cardGlow,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    flex: 1,
  },
});
