import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
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
import { storageService, User, AttendanceRecord } from '../../services/storageService';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { t, getLocale, addLocaleListener } from '../../services/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

function DateBadge({ dateString }: { dateString: string }) {
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) {
      return (
        <View style={styles.dateBadgeContainer}>
          <View style={styles.dateBadgeHeader} />
          <View style={styles.dateBadgeBody}>
            <Text style={styles.dateBadgeDay}>--</Text>
            <Text style={styles.dateBadgeMonth}>---</Text>
          </View>
        </View>
      );
    }
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    
    return (
      <View style={styles.dateBadgeContainer}>
        <View style={styles.dateBadgeHeader} />
        <View style={styles.dateBadgeBody}>
          <Text style={styles.dateBadgeDay}>{day}</Text>
          <Text style={styles.dateBadgeMonth}>{month}</Text>
        </View>
      </View>
    );
  } catch {
    return (
      <View style={styles.dateBadgeContainer}>
        <View style={styles.dateBadgeHeader} />
        <View style={styles.dateBadgeBody}>
          <Text style={styles.dateBadgeDay}>--</Text>
          <Text style={styles.dateBadgeMonth}>---</Text>
        </View>
      </View>
    );
  }
}

function CalendarGrid({ logs }: { logs: AttendanceRecord[] }) {
  const [selectedDayInfo, setSelectedDayInfo] = useState<string | null>(null);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  
  // Total days in the current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Day of week for the 1st of the month
  const firstDayIndex = new Date(year, month, 1).getDay();

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Construct grid cells
  const cells: Array<{ day: number | null; dateStr: string; status: 'future' | 'absent' | 'checkIn' | 'checkOut' | 'completed'; record?: AttendanceRecord }> = [];

  // Pad cells before the 1st day of the month
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ day: null, dateStr: '', status: 'future' });
  }

  const todayStr = today.toISOString().split('T')[0];

  for (let d = 1; d <= totalDays; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Check if future day
    const isFuture = dStr > todayStr;
    
    // Find record
    const record = logs.find(r => r.date === dStr);
    
    let status: 'future' | 'absent' | 'checkIn' | 'checkOut' | 'completed' = 'absent';
    if (isFuture) {
      status = 'future';
    } else if (record) {
      if (record.checkIn && record.checkOut) {
        status = 'completed';
      } else if (record.checkIn) {
        status = 'checkIn';
      } else if (record.checkOut) {
        status = 'checkOut';
      }
    }

    cells.push({
      day: d,
      dateStr: dStr,
      status,
      record
    });
  }

  // Get color for status
  const getCellColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.successDim; // Green background tint
      case 'checkIn': return Colors.accentDim; // Blue/Cyan background tint
      case 'checkOut': return Colors.secondaryDim; // Purple background tint
      case 'absent': return 'rgba(255, 69, 58, 0.08)'; // Dim red background tint
      case 'future':
      default:
        return 'rgba(255, 255, 255, 0.02)'; // Dark transparent
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'checkIn': return Colors.accent;
      case 'checkOut': return Colors.secondary;
      case 'absent': return Colors.danger;
      case 'future':
      default:
        return 'rgba(255, 255, 255, 0.06)';
    }
  };

  const handleCellPress = (cell: typeof cells[0]) => {
    if (!cell.day || cell.status === 'future') return;
    
    const formattedDate = new Date(cell.dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric'
    });

    if (cell.status === 'absent') {
      setSelectedDayInfo(`${formattedDate}: ${t('legendAbsent') || 'Absent'}`);
    } else if (cell.record) {
      const inTime = cell.record.checkIn || '--:--';
      const outTime = cell.record.checkOut || t('haventMarkedOut') || 'In Progress';
      setSelectedDayInfo(`${formattedDate}: 📥 ${inTime} 📤 ${outTime}`);
    }
  };

  // Chunk cells into rows of 7
  const rows: typeof cells[] = [];
  let currentRow: typeof cells = [];
  cells.forEach((cell, idx) => {
    currentRow.push(cell);
    if (currentRow.length === 7 || idx === cells.length - 1) {
      if (idx === cells.length - 1) {
        while (currentRow.length < 7) {
          currentRow.push({ day: null, dateStr: '', status: 'future' });
        }
      }
      rows.push(currentRow);
      currentRow = [];
    }
  });

  return (
    <View style={styles.calendarContainer}>
      <Text style={styles.calendarSectionTitle}>{t('attendanceCalendar') || 'Attendance Calendar'}</Text>
      
      {/* Month Header */}
      <Text style={styles.calendarMonthText}>
        {today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
      </Text>

      <View style={styles.calendarFlexContainer}>
        {/* Calendar Grid Area */}
        <View style={styles.gridArea}>
          {/* Weekday headers */}
          <View style={styles.calendarWeekdaysRow}>
            {daysOfWeek.map((day, idx) => (
              <Text key={`weekday-${idx}`} style={styles.weekdayHeaderText}>{day}</Text>
            ))}
          </View>

          {/* Grid rows */}
          {rows.map((row, rowIdx) => (
            <View key={`row-${rowIdx}`} style={styles.calendarGridRow}>
              {row.map((cell, cellIdx) => {
                const hasDetails = cell.day !== null && cell.status !== 'future';
                return (
                  <Pressable
                    key={`cell-${rowIdx}-${cellIdx}`}
                    onPress={() => handleCellPress(cell)}
                    disabled={!hasDetails}
                    style={({ pressed }) => [
                      styles.calendarCell,
                      {
                        backgroundColor: getCellColor(cell.status),
                        borderColor: getBorderColor(cell.status),
                      },
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    {cell.day && (
                      <Text style={[
                        styles.calendarCellText,
                        cell.status === 'future' && { color: Colors.textTertiary }
                      ]}>
                        {cell.day}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Vertical Legend Column on the side */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: Colors.successDim, borderColor: Colors.success }]} />
            <Text style={styles.legendLabelText}>{t('legendCompleted') || 'Completed'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: Colors.accentDim, borderColor: Colors.accent }]} />
            <Text style={styles.legendLabelText}>{t('legendCheckedIn') || 'Checked In'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: Colors.secondaryDim, borderColor: Colors.secondary }]} />
            <Text style={styles.legendLabelText}>{t('legendCheckedOut') || 'Checked Out'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: 'rgba(255, 69, 58, 0.08)', borderColor: Colors.danger }]} />
            <Text style={styles.legendLabelText}>{t('legendAbsent') || 'Absent'}</Text>
          </View>
        </View>
      </View>

      {/* Selected Day Tooltip */}
      {selectedDayInfo && (
        <View style={styles.selectedDayInfoBox}>
          <MaterialCommunityIcons name="information-outline" size={14} color={Colors.accent} style={{ marginRight: 6 }} />
          <Text style={styles.selectedDayInfoText}>{selectedDayInfo}</Text>
          <Pressable onPress={() => setSelectedDayInfo(null)} style={styles.selectedDayCloseBtn}>
            <MaterialCommunityIcons name="close" size={14} color={Colors.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function AttendanceScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'me' | 'team'>('me');
  const [loading, setLoading] = useState(true);
  
  // Me states
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [stats, setStats] = useState({ present: 0, absent: 0, avgHours: '0h 0m', percentage: 0 });
  const [timeRange, setTimeRange] = useState<'7days' | '30days'>('7days');
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);
  
  // Team states
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  
  // Locale State
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    return addLocaleListener(() => {
      setLocaleState(getLocale());
    });
  }, []);

  const loadData = () => {
    setLoading(true);
    // Load general users list (for My Team)
    const fetchedUsers = storageService.getUsers();
    setUsers(fetchedUsers);
    
    // Load logged in user info (for Me)
    const currentUser = storageService.getLoggedInUser();
    setLoggedInUser(currentUser);
    
    if (currentUser) {
      // Fetch attendance logs for user
      const records = storageService.getAttendanceRecords(currentUser.id);
      setAttendanceLogs(records);
      
      // Compute Today's Record
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = records.find(r => r.date === todayStr);
      setTodayRecord(todayRec || null);
      
      // Fetch Attendance Stats
      const computedStats = storageService.getAttendanceStats(currentUser.id);
      setStats(computedStats);
    } else {
      // Fail-safe default logs for demonstration
      const records = storageService.getAttendanceRecords('1');
      setAttendanceLogs(records);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = records.find(r => r.date === todayStr);
      setTodayRecord(todayRec || null);
      
      const computedStats = storageService.getAttendanceStats('1');
      setStats(computedStats);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload when screen gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleMarkAttendance = () => {
    // Navigate to biometric scan
    router.push('/authenticate');
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    setDeleteTarget(user);
  };

  const confirmDeleteUser = () => {
    if (!deleteTarget) return;
    storageService.deleteUser(deleteTarget.id);
    storageService.deleteFaceEmbedding(deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  };

  const getDurationStr = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return t('haventMarkedOut') || "haven't marked out";
    try {
      const parseTime = (tStr: string) => {
        const [time, modifier] = tStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      const inMins = parseTime(checkIn);
      const outMins = parseTime(checkOut);
      if (outMins > inMins) {
        const diff = outMins - inMins;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return `${h}h ${m}m`;
      }
      return "0h 0m";
    } catch {
      return "8h 30m";
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <UserListSkeleton />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Top Header Section */}
      <View style={styles.topBar}>
        <View style={styles.headerTitleContainer}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('attendance')}</Text>
        </View>
        
        {/* Toggle Pills: Me / My Team */}
        <View style={styles.toggleContainer}>
          <Pressable
            onPress={() => setActiveTab('me')}
            style={[styles.toggleButton, activeTab === 'me' && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, activeTab === 'me' && styles.toggleTextActive]}>
              {t('me')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('team')}
            style={[styles.toggleButton, activeTab === 'team' && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, activeTab === 'team' && styles.toggleTextActive]}>
              {t('myTeam')}
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === 'me' ? (
        /* ME TAB VIEW */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TODAY'S ATTENDANCE CARD */}
          <GlassCard style={styles.attendanceCard} padding={16} glow>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('myTodaysAttendance')}</Text>
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color={Colors.accent} />
            </View>
            
            <View style={styles.todayLogDetails}>
              <DateBadge dateString={new Date().toISOString()} />
              <View style={styles.todayTextContainer}>
                {todayRecord ? (
                  <>
                    <Text style={styles.todayTimeText}>
                      {todayRecord.checkIn} {todayRecord.checkOut ? `→ ${todayRecord.checkOut}` : `→ ${t('haventMarkedOut')}`}
                    </Text>
                    <Text style={styles.todayNoteText}>
                      {todayRecord.note || "Biometric entry registered."}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.todayTimeText}>--:-- → --:--</Text>
                    <Text style={styles.todayNoteText}>
                      No biometric entry recorded for today.
                    </Text>
                  </>
                )}
              </View>
            </View>

            <Pressable
              onPress={handleMarkAttendance}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed
              ]}
            >
              <MaterialCommunityIcons name="face-recognition" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>{t('markYourAttendance')}</Text>
            </Pressable>
          </GlassCard>

          {/* OVERVIEW STATS CARD */}
          <GlassCard style={styles.attendanceCard} padding={16}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('myOverview')}</Text>
              <Pressable 
                onPress={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
                style={styles.dropdownTrigger}
              >
                <Text style={styles.dropdownText}>
                  {timeRange === '7days' ? t('last7Days') : t('last30Days')}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={Colors.accent} />
              </Pressable>
            </View>

            {showTimeRangeDropdown && (
              <View style={styles.dropdownMenu}>
                <Pressable
                  onPress={() => {
                    setTimeRange('7days');
                    setShowTimeRangeDropdown(false);
                  }}
                  style={styles.dropdownMenuItem}
                >
                  <Text style={styles.dropdownMenuItemText}>{t('last7Days')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setTimeRange('30days');
                    setShowTimeRangeDropdown(false);
                  }}
                  style={styles.dropdownMenuItem}
                >
                  <Text style={styles.dropdownMenuItemText}>{t('last30Days')}</Text>
                </Pressable>
              </View>
            )}

            {/* Stats Grid (2x2) */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <View style={styles.statsCol}>
                  <Text style={styles.statNumber}>{stats.present}</Text>
                  <Text style={styles.statLabel}>{t('totalPresentDays')}</Text>
                </View>
                <View style={styles.statsCol}>
                  <Text style={styles.statNumber}>{stats.absent}</Text>
                  <Text style={styles.statLabel}>{t('totalAbsents')}</Text>
                </View>
              </View>
              <View style={styles.statsRowDivider} />
              <View style={styles.statsRow}>
                <View style={styles.statsCol}>
                  <Text style={styles.statNumber}>{stats.avgHours}</Text>
                  <Text style={styles.statLabel}>{t('avgWorkingHours')}</Text>
                </View>
                <View style={styles.statsCol}>
                  <Text style={styles.statNumber}>{stats.percentage}%</Text>
                  <Text style={styles.statLabel}>{t('attendancePercentage')}</Text>
                </View>
              </View>
            </View>
          </GlassCard>

          {/* REPORT LIST CARD */}
          <GlassCard style={styles.attendanceCard} padding={16}>
            <View style={[styles.cardHeader, { marginBottom: 12 }]}>
              <Text style={styles.cardTitle}>{t('myAttendanceReport')}</Text>
            </View>

            {/* Attendance Calendar Grid */}
            <CalendarGrid logs={attendanceLogs} />
            <View style={styles.reportSectionDivider} />
            
            {attendanceLogs.length === 0 ? (
              <Text style={styles.emptyReportText}>No previous attendance history found.</Text>
            ) : (
              attendanceLogs.map((log, idx) => (
                <View key={log.id}>
                  {idx > 0 && <View style={styles.reportDivider} />}
                  <View style={styles.reportItem}>
                    <DateBadge dateString={log.date} />
                    <View style={styles.reportMiddle}>
                      <Text style={styles.reportTimeRange}>
                        {log.checkIn} {log.checkOut ? `→ ${log.checkOut}` : `→ ${t('haventMarkedOut')}`}
                      </Text>
                      <View style={styles.durationRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={Colors.textTertiary} />
                        <Text style={styles.durationText}>
                          {getDurationStr(log.checkIn, log.checkOut)}
                        </Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
                  </View>
                </View>
              ))
            )}
          </GlassCard>
        </ScrollView>
      ) : (
        /* MY TEAM TAB VIEW */
        <View style={{ flex: 1 }}>
          {/* Search bar */}
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

          {/* Users List */}
          {filteredUsers.length === 0 && searchQuery === '' ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <MaterialCommunityIcons name="account-group-outline" size={64} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>{t('noUsers')}</Text>
              <Text style={styles.emptySubtitle}>{t('noUsersDesc')}</Text>
              <AnimatedButton
                label={t('registerFirst')}
                onPress={() => router.push('/register')}
                icon="account-plus"
                style={{ marginTop: 24 }}
              />
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => (
                <UserCard
                  user={item}
                  index={index}
                  onDelete={() => handleDeleteUser(item.id)}
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

          {/* Floating Action Button (FAB) */}
          <PulsingFab onPress={() => router.push('/register')} />
        </View>
      )}

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title={t('removeUser')}
        message={t('removeUserDesc')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        icon="trash-can-outline"
        onConfirm={confirmDeleteUser}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
    backgroundColor: Colors.background,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toggleButtonActive: {
    backgroundColor: '#0052CC', // Deep blue to match image screenshot buttons
  },
  toggleText: {
    ...Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  attendanceCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cardTitle: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  todayLogDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    marginBottom: 6,
  },
  dateBadgeContainer: {
    width: 48,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  dateBadgeHeader: {
    height: 4,
    backgroundColor: '#0052CC',
  },
  dateBadgeBody: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeDay: {
    ...Typography.heading,
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  dateBadgeMonth: {
    ...Typography.bodyMedium,
    fontSize: 9,
    color: Colors.accent,
    marginTop: 1,
  },
  todayTextContainer: {
    flex: 1,
  },
  todayTimeText: {
    ...Typography.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  todayNoteText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#0052CC',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...Shadows.glow('rgba(0, 82, 204, 0.2)'),
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    ...Typography.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dropdownText: {
    ...Typography.bodyMedium,
    fontSize: 11,
    color: Colors.accent,
  },
  dropdownMenu: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: BorderRadius.md,
    marginTop: 6,
    paddingVertical: 4,
    position: 'absolute',
    right: 16,
    top: 48,
    zIndex: 10,
    width: 120,
    ...Shadows.card,
  },
  dropdownMenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownMenuItemText: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  statsGrid: {
    marginTop: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statsRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statsCol: {
    flex: 1,
  },
  statNumber: {
    ...Typography.heading,
    fontSize: 22,
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  reportMiddle: {
    flex: 1,
  },
  reportTimeRange: {
    ...Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  durationText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reportDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: 10,
  },
  emptyReportText: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginVertical: 20,
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
    marginTop: 20,
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
    paddingBottom: 120,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
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
  // Calendar Grid styles
  calendarContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  calendarSectionTitle: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarMonthText: {
    ...Typography.heading,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  calendarFlexContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridArea: {
    flex: 2.2,
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayHeaderText: {
    width: 24,
    textAlign: 'center',
    ...Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.textTertiary,
  },
  calendarGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calendarCell: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellText: {
    ...Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.textPrimary,
  },
  legendContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.05)',
    paddingLeft: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendLabelText: {
    ...Typography.body,
    fontSize: 9,
    color: Colors.textSecondary,
  },
  selectedDayInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.06)',
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    position: 'relative',
  },
  selectedDayInfoText: {
    ...Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 16,
  },
  selectedDayCloseBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
  },
  reportSectionDivider: {
    height: 1,
    backgroundColor: Colors.borderDefault,
    marginVertical: 14,
  },
});
