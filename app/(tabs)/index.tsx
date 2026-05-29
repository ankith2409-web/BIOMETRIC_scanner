import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';
import GlassCard from '../../components/ui/GlassCard';
import StatusBadge from '../../components/ui/StatusBadge';
import NetworkIndicator from '../../components/ui/NetworkIndicator';
import HomeSkeleton from '../../components/skeletons/HomeSkeleton';
import { Colors, Typography, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { storageService, User, AuthLog } from '../../services/storageService';
import { t, getLocale, addLocaleListener } from '../../services/i18n';

function StatCard({
  value,
  label,
  icon,
  color,
  delay,
}: {
  value: number;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(600)} style={{ flex: 1 }}>
      <GlassCard style={styles.statCard} padding={14} glow>
        <View style={[styles.statIconBg, { backgroundColor: color + '18' }]}>
          <MaterialCommunityIcons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
}

function ActionCard({ 
  title, 
  subtitle, 
  icon, 
  gradientColors, 
  onPress, 
  delay 
}: { 
  title: string; 
  subtitle: string; 
  icon: keyof typeof MaterialCommunityIcons.glyphMap; 
  gradientColors: [string, string]; 
  onPress: () => void;
  delay: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(600).springify()} style={{ flex: 1 }}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={animatedStyle}
      >
        <View style={styles.actionCard}>
          <LinearGradient
            colors={[gradientColors[0] + '20', gradientColors[1] + '08']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {/* Top shimmer line */}
          <LinearGradient
            colors={['transparent', gradientColors[0] + '30', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardShimmerLine}
          />
          <View style={[styles.actionIconBg, { backgroundColor: gradientColors[0] + '20' }]}>
            <MaterialCommunityIcons name={icon} size={28} color={gradientColors[0]} />
          </View>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
          <View style={styles.actionArrow}>
            <MaterialCommunityIcons name="arrow-right" size={18} color={gradientColors[0]} />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function ActivityItem({ item, index }: { item: AuthLog; index: number }) {
  const initials = item.name === 'Unknown' || item.name === 'Unknown User' ? '?' : item.name.split(' ').map(n => n[0]).join('');
  const isSuccess = item.status === 'success';
  const accentColor = isSuccess ? Colors.success : Colors.danger;

  return (
    <Animated.View entering={FadeInUp.delay(400 + index * 80).duration(500)}>
      <View style={styles.activityItem}>
        {/* Left accent border */}
        <View style={[styles.activityAccentBorder, { backgroundColor: accentColor }]} />
        <View style={[styles.avatar, { borderColor: accentColor + '40' }]}>
          <Text style={[styles.avatarText, { color: accentColor }]}>
            {initials}
          </Text>
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityName}>{item.name}</Text>
          <Text style={styles.activityTime}>{item.timestamp}</Text>
        </View>
        <View style={styles.activityRight}>
          <StatusBadge
            label={isSuccess ? t('verified') : t('failed')}
            variant={item.status === 'success' ? 'success' : 'danger'}
          />
          {isSuccess && (
            <Text style={styles.confidenceText}>{item.confidence}%</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    return addLocaleListener(() => {
      setLocaleState(getLocale());
    });
  }, []);

  const loadData = () => {
    const fetchedUsers = storageService.getUsers();
    const fetchedLogs = storageService.getLogs();
    const currentUser = storageService.getLoggedInUser();
    setUsers(fetchedUsers);
    setLogs(fetchedLogs);
    setLoggedInUser(currentUser);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload data when dashboard gets focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleSignOut = () => {
    storageService.setLoggedInUser(null);
    router.replace('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greetingMorning');
    if (hour < 17) return t('greetingAfternoon');
    return t('greetingEvening');
  };

  // Compute stats
  const totalUsers = users.length;
  const verifiedCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failure').length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Subtle radial glow behind header */}
      <LinearGradient
        colors={['rgba(0, 212, 255, 0.06)', 'rgba(124, 92, 252, 0.03)', 'transparent']}
        style={styles.headerGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {loggedInUser?.name || 'Operator'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <NetworkIndicator isOnline={isOnline} />
            <Pressable
              onPress={handleSignOut}
              style={styles.signOutButton}
            >
              <MaterialCommunityIcons name="logout" size={20} color={Colors.danger} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard value={totalUsers} label={t('totalUsers')} icon="account-group" color={Colors.accent} delay={100} />
          <StatCard value={verifiedCount} label={t('verified')} icon="check-decagram" color={Colors.success} delay={150} />
          <StatCard value={failedCount} label={t('failed')} icon="alert-circle" color={Colors.danger} delay={200} />
        </View>

        {/* Action Cards */}
        <View style={styles.actionRow}>
          <ActionCard
            title={t('registerFace')}
            subtitle={t('enrollNew')}
            icon="face-recognition"
            gradientColors={[Colors.accent, '#0066CC']}
            onPress={() => router.push('/register-portal')}
            delay={250}
          />
          <ActionCard
            title={t('authenticate')}
            subtitle={t('verifyNow')}
            icon="shield-check"
            gradientColors={[Colors.success, '#00CC6A']}
            onPress={() => router.push('/authenticate')}
            delay={350}
          />
        </View>

        {/* Recent Activity */}
        <Animated.View entering={FadeIn.delay(350).duration(600)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recentActivity')}</Text>
            <Pressable onPress={() => router.push('/sync')}>
              <Text style={styles.viewAll}>{t('viewLog')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {logs.length === 0 ? (
          <Text style={{ color: Colors.textTertiary, textAlign: 'center', marginTop: 20 }}>
            {t('noActivity')}
          </Text>
        ) : (
          logs.slice(0, 5).map((item, index) => (
            <ActivityItem key={item.id} item={item} index={index} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  userName: {
    ...Typography.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.textPrimary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    ...Typography.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.xl,
    padding: 20,
    height: 170,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardShimmerLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    ...Typography.heading,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  actionSubtitle: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionArrow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    ...Typography.headingMedium,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
  },
  viewAll: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  activityAccentBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.sm,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  activityTime: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  confidenceText: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signOutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
  },
});
