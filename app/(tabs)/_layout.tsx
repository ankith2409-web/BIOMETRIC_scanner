import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Typography, FontSizes, Shadows } from '../../constants/theme';
import { storageService } from '../../services/storageService';
import { t, getLocale, addLocaleListener } from '../../services/i18n';

function TabIcon({ 
  name, 
  color, 
  focused 
}: { 
  name: keyof typeof MaterialCommunityIcons.glyphMap; 
  color: any; 
  focused: boolean;
}) {
  const scale = useSharedValue(1);

  if (focused) {
    scale.value = withSpring(1.15, { damping: 12, stiffness: 200 });
  } else {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.iconContainer, focused && styles.iconContainerActive, animatedStyle]}>
      <MaterialCommunityIcons name={name} size={24} color={color} />
      {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
    </Animated.View>
  );
}

function BreathingShield() {
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value * 0.5,
    transform: [{ scale: 0.98 + glowOpacity.value * 0.04 }],
  }));

  return (
    <Animated.View style={[styles.centerButton, glowStyle]}>
      <MaterialCommunityIcons name="shield-check" size={28} color={Colors.background} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    return addLocaleListener(() => {
      setLocaleState(getLocale());
    });
  }, []);

  // Auth guard: redirect to login if no user is logged in
  useEffect(() => {
    const loggedInUser = storageService.getLoggedInUser();
    if (!loggedInUser) {
      router.replace('/login');
    } else {
      setAuthChecked(true);
    }
  }, []);

  // Don't render tabs until auth check completes (prevents dashboard flash)
  if (!authChecked) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            {/* Dark base */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 15, 30, 0.97)' }]} />
            {/* Top gradient line */}
            <LinearGradient
              colors={[Colors.accent, Colors.secondary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tabBarTopLine}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t('users'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="account-group" color={color} focused={focused} />
          ),
        }}
      />
      {/* Center auth button - special styling (purely decorative icon) */}
      <Tabs.Screen
        name="auth-placeholder"
        options={{
          title: '',
          tabBarIcon: () => <BreathingShield />,
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: t('sync'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="cloud-sync" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="cog" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    height: 70,
    paddingBottom: 8,
    paddingTop: 6,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
  },
  tabBarTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 0.5,
  },
  tabLabel: {
    ...Typography.body,
    fontSize: 10,
    letterSpacing: 0.3,
    marginTop: -2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 32,
    gap: 2,
  },
  iconContainerActive: {
    // No additional styling needed; the dot handles active indicator
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: -4,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    ...Shadows.glow(Colors.accent),
    borderWidth: 3,
    borderColor: Colors.background,
  },
});
