import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable,
  StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  FadeInUp,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import GlassCard from '../../components/ui/GlassCard';
import StatusBadge from '../../components/ui/StatusBadge';
import AnimatedButton from '../../components/ui/AnimatedButton';
import UserListSkeleton from '../../components/skeletons/UserListSkeleton';
import { Colors, Typography, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { storageService, User } from '../../services/storageService';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { t, getLocale, addLocaleListener } from '../../services/i18n';

function UserCard({ user, index, onDelete }: { user: User; index: number; onDelete: () => void }) {
  const initials = user.name ? user.name.split(' ').filter(Boolean).map(n => n[0]).join('') : 'U';
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(500)}
      layout={Layout.springify()}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.98); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onLongPress={onDelete}
        >
          <View style={styles.userCard}>
            {/* Left accent border */}
            <View style={styles.userAccentBorder} />
            <View style={styles.userAvatarRing}>
              <LinearGradient
                colors={[Colors.accent, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradientRing}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userInitials}>{initials}</Text>
                </View>
              </LinearGradient>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <View style={styles.userMeta}>
                <MaterialCommunityIcons name="calendar-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.userDate}>
                  {new Date(user.registeredAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
            <StatusBadge
              label={user.status === 'active' ? t('active') : t('pending')}
              variant={user.status === 'active' ? 'success' : 'pending'}
              pulsing={true}
            />
            <Pressable onPress={onDelete} style={styles.deleteBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.danger} />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function PulsingFab({ onPress }: { onPress: () => void }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View style={[styles.fab, pulseStyle]}>
      <Pressable
        style={styles.fabInner}
        onPress={onPress}
      >
        <MaterialCommunityIcons name="plus" size={28} color={Colors.background} />
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ onRegister }: { onRegister: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(800)} style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons name="account-group-outline" size={64} color={Colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{t('noUsers')}</Text>
      <Text style={styles.emptySubtitle}>
        {t('noUsersDesc')}
      </Text>
      <AnimatedButton
        label={t('registerFirst')}
        onPress={onRegister}
        icon="account-plus"
        style={{ marginTop: 24 }}
      />
    </Animated.View>
  );
}

export default function UsersScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    return addLocaleListener(() => {
      setLocaleState(getLocale());
    });
  }, []);

  const loadUsers = () => {
    const data = storageService.getUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Reload when screen gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUsers();
    });
    return unsubscribe;
  }, [navigation]);

  if (loading) return <UserListSkeleton />;

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    setDeleteTarget(user);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    storageService.deleteUser(deleteTarget.id);
    storageService.deleteFaceEmbedding(deleteTarget.id);
    setDeleteTarget(null);
    loadUsers();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
        <Text style={styles.headerTitle}>{t('usersTitle')}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{users.length}</Text>
        </View>
      </Animated.View>

      {/* Search */}
      <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textTertiary} />
          </Pressable>
        )}
      </Animated.View>

      {/* User list */}
      {filteredUsers.length === 0 && searchQuery === '' ? (
        <EmptyState onRegister={() => router.push('/register')} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <UserCard
              user={item}
              index={index}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <MaterialCommunityIcons name="account-search" size={40} color={Colors.textTertiary} />
              <Text style={styles.noResultsText}>{t('noUsersFound')}</Text>
            </View>
          }
        />
      )}

      {/* FAB with glow */}
      <PulsingFab onPress={() => router.push('/register')} />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title={t('removeUser')}
        message={t('removeUserDesc')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        icon="trash-can-outline"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  countText: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  userCard: {
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
  userAccentBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  userAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarGradientRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitials: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.accent,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  userDate: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Shadows.glow(Colors.accent),
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    ...Typography.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  noResults: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  noResultsText: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
});
