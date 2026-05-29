import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import GlassCard from '../../components/ui/GlassCard';
import AnimatedButton from '../../components/ui/AnimatedButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import IndianFlag from '../../components/ui/IndianFlag';
import { Colors, Typography, FontSizes, BorderRadius, Shadows } from '../../constants/theme';
import { storageService, User } from '../../services/storageService';
import { t, getLocale, setLocale, addLocaleListener } from '../../services/i18n';

function SettingRow({ 
  icon, 
  label, 
  description, 
  children 
}: { 
  icon: keyof typeof MaterialCommunityIcons.glyphMap; 
  label: string; 
  description?: string; 
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.accent} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      {children}
    </View>
  );
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const thumbPos = useSharedValue(value ? 20 : 0);
  const bgOpacity = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    thumbPos.value = withTiming(value ? 20 : 0, { duration: 250, easing: Easing.out(Easing.cubic) });
    bgOpacity.value = withTiming(value ? 1 : 0, { duration: 250 });
  }, [value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbPos.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: bgOpacity.value > 0.5
      ? 'rgba(0, 212, 255, 0.2)'
      : 'rgba(255, 255, 255, 0.1)',
  }));

  return (
    <Pressable onPress={onToggle}>
      <Animated.View style={[styles.toggle, bgStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle, value && styles.toggleThumbActive]} />
      </Animated.View>
    </Pressable>
  );
}

const LANGUAGES = [
  { id: 'en', language: 'English', nativeLanguage: 'English', flag: 'us-uk' },
  { id: 'hi', language: 'Hindi', nativeLanguage: 'हिंदी', flag: 'in' },
  { id: 'mr', language: 'Marathi', nativeLanguage: 'मराठी', flag: 'in' },
  { id: 'ta', language: 'Tamil', nativeLanguage: 'தமிழ்', flag: 'in' },
  { id: 'te', language: 'Telugu', nativeLanguage: 'తెలుగు', flag: 'in' },
  { id: 'kn', language: 'Kannada', nativeLanguage: 'ಕನ್ನಡ', flag: 'in' },
  { id: 'bn', language: 'Bengali', nativeLanguage: 'বাংলা', flag: 'in' },
  { id: 'gu', language: 'Gujarati', nativeLanguage: 'ગુજરાતી', flag: 'in' },
  { id: 'ml', language: 'Malayalam', nativeLanguage: 'മലയാളം', flag: 'in' },
  { id: 'pa', language: 'Punjabi', nativeLanguage: 'ਪੰਜਾਬੀ', flag: 'in' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [threshold, setThreshold] = useState(0.80);
  const [endpoint, setEndpoint] = useState('https://api.facegate.io/sync');
  const [showConfidence, setShowConfidence] = useState(true);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [currentLocale, setCurrentLocale] = useState(getLocale());

  useEffect(() => {
    return addLocaleListener(() => {
      setCurrentLocale(getLocale());
    });
  }, []);

  // Load settings on mount
  useEffect(() => {
    const settings = storageService.getSettings();
    setThreshold(settings.threshold);
    setEndpoint(settings.awsEndpoint);
    setShowConfidence(settings.showConfidence);
    setLoggedInUser(storageService.getLoggedInUser());
  }, []);

  const handleSaveSettings = (newThreshold: number, newShowConfidence: boolean, newEndpoint: string) => {
    const current = storageService.getSettings();
    storageService.saveSettings({
      ...current,
      threshold: newThreshold,
      showConfidence: newShowConfidence,
      awsEndpoint: newEndpoint,
    });
  };

  const adjustThreshold = (delta: number) => {
    setThreshold(prev => {
      const newVal = Math.max(0.75, Math.min(0.95, +(prev + delta).toFixed(2)));
      handleSaveSettings(newVal, showConfidence, endpoint);
      return newVal;
    });
  };

  const handleToggleConfidence = () => {
    const nextVal = !showConfidence;
    setShowConfidence(nextVal);
    handleSaveSettings(threshold, nextVal, endpoint);
  };

  const handleEndpointChange = (val: string) => {
    setEndpoint(val);
    handleSaveSettings(threshold, showConfidence, val);
  };

  const handleConfirmPurge = () => {
    storageService.purgeAll();
    setShowPurgeDialog(false);

    // Reset local UI states to default settings
    const settings = storageService.getSettings();
    setThreshold(settings.threshold);
    setEndpoint(settings.awsEndpoint);
    setShowConfidence(settings.showConfidence);
  };

  const handleSignOut = () => {
    storageService.setLoggedInUser(null);
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
          <Text style={styles.headerTitle}>{t('settings')}</Text>
        </Animated.View>

        {/* Match Threshold */}
        <Animated.View entering={FadeInUp.delay(100).duration(600)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="tune-variant" size={20} color={Colors.accent} />
              <Text style={styles.sectionTitle}>{t('recognition')}</Text>
            </View>
            <LinearGradient
              colors={[Colors.accent, Colors.secondary, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionUnderline}
            />

            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>{t('matchThreshold')}</Text>
                <View style={styles.thresholdBadge}>
                  <Text style={styles.thresholdValue}>{threshold.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderMin}>0.75</Text>
                <View style={styles.sliderWrapper}>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${((threshold - 0.75) / 0.20) * 100}%` }]} />
                    <Pressable
                      style={[styles.sliderThumb, { left: `${((threshold - 0.75) / 0.20) * 100}%` }]}
                      onStartShouldSetResponder={() => true}
                    />
                  </View>
                  {/* Using a transparent native slider overlay for touch handling */}
                  <View style={styles.nativeSliderOverlay}>
                    {/* @ts-ignore - Slider may not have types */}
                    <TextInput
                      style={{ display: 'none' }}
                    />
                  </View>
                </View>
                <Text style={styles.sliderMax}>0.95</Text>
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderHint}>{t('strict')}</Text>
                <Text style={styles.sliderHint}>{t('lenient')}</Text>
              </View>
              {/* Actual functional buttons to adjust */}
              <View style={styles.adjustButtons}>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => adjustThreshold(-0.01)}
                >
                  <MaterialCommunityIcons name="minus" size={16} color={Colors.accent} />
                </Pressable>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => adjustThreshold(0.01)}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={Colors.accent} />
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            <SettingRow icon="shield-check-outline" label={t('showConfidence')} description={t('showConfidenceDesc')}>
              <Toggle value={showConfidence} onToggle={handleToggleConfidence} />
            </SettingRow>
          </GlassCard>
        </Animated.View>

        {/* Region & Language selector */}
        <Animated.View entering={FadeInUp.delay(150).duration(600)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="translate" size={20} color={Colors.accent} />
              <Text style={styles.sectionTitle}>{t('selectLocale')}</Text>
            </View>
            <LinearGradient
              colors={[Colors.accent, Colors.secondary, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionUnderline}
            />
            <View style={styles.languageSelectContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {LANGUAGES.map((lang) => {
                  const isSelected = currentLocale === lang.id;
                  return (
                    <Pressable
                      key={lang.id}
                      onPress={() => {
                        setLocale(lang.id);
                      }}
                      style={[
                        styles.langBadge,
                        isSelected && styles.langBadgeActive,
                        { flexDirection: 'row', alignItems: 'center', gap: 6 }
                      ]}
                    >
                      {lang.flag === 'in' ? (
                        <IndianFlag width={16} height={11} />
                      ) : (
                        <MaterialCommunityIcons 
                          name="web" 
                          size={14} 
                          color={isSelected ? Colors.accent : Colors.textSecondary} 
                        />
                      )}
                      <Text style={[styles.langBadgeText, isSelected && styles.langBadgeTextActive]}>
                        {lang.nativeLanguage} ({lang.language})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </GlassCard>
        </Animated.View>

        {/* AWS Endpoint */}
        <Animated.View entering={FadeInUp.delay(200).duration(600)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cloud-outline" size={20} color={Colors.accent} />
              <Text style={styles.sectionTitle}>{t('cloudConfig')}</Text>
            </View>

            <Text style={styles.inputLabel}>{t('awsEndpoint')}</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="link-variant" size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.textInput}
                value={endpoint}
                onChangeText={handleEndpointChange}
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Account Management */}
        <Animated.View entering={FadeInUp.delay(250).duration(600)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-cog-outline" size={20} color={Colors.accent} />
              <Text style={styles.sectionTitle}>{t('account')}</Text>
            </View>

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>{t('loggedInAs')}</Text>
              <Text style={styles.aboutValue}>{loggedInUser?.name || 'Operator'}</Text>
            </View>
            {loggedInUser?.phone && (
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>{t('phoneNumber')}</Text>
                <Text style={styles.aboutValue}>{loggedInUser.phone}</Text>
              </View>
            )}

            <AnimatedButton
              label={t('signOut')}
              onPress={handleSignOut}
              variant="primary"
              icon="logout"
              size="md"
              style={{ marginTop: 16 }}
            />
          </GlassCard>
        </Animated.View>

        {/* Data Management */}
        <Animated.View entering={FadeInUp.delay(300).duration(600)}>
          <GlassCard style={styles.section} variant="danger">
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="database-alert" size={20} color={Colors.danger} />
              <Text style={styles.sectionTitle}>{t('dataManagement')}</Text>
            </View>

            <Text style={styles.dangerDescription}>
              {t('purgeDesc')}
            </Text>

            <AnimatedButton
              label={t('purgeBtn')}
              onPress={() => setShowPurgeDialog(true)}
              variant="danger"
              icon="delete-forever"
              size="md"
              style={{ marginTop: 8 }}
            />
          </GlassCard>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInUp.delay(400).duration(600)}>
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="information-outline" size={20} color={Colors.accent} />
              <Text style={styles.sectionTitle}>{t('about')}</Text>
            </View>

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>{t('appVersion')}</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>{t('modelVersion')}</Text>
              <Text style={styles.aboutValue}>FaceNet v2.1</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>{t('tfliteRuntime')}</Text>
              <Text style={styles.aboutValue}>2.14.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>{t('localDatabase')}</Text>
              <Text style={styles.aboutValue}>SQLite 3.39</Text>
            </View>
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* Purge confirmation dialog */}
      <ConfirmDialog
        visible={showPurgeDialog}
        title={t('purgeConfirmTitle')}
        message={t('purgeConfirmDesc')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        icon="delete-alert"
        onConfirm={handleConfirmPurge}
        onCancel={() => setShowPurgeDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.textPrimary,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionUnderline: {
    height: 1.5,
    borderRadius: 1,
    marginBottom: 14,
    opacity: 0.4,
  },
  sectionTitle: {
    ...Typography.headingMedium,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginVertical: 14,
  },
  // Slider
  sliderContainer: {
    gap: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  thresholdBadge: {
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  thresholdValue: {
    ...Typography.heading,
    fontSize: FontSizes.md,
    color: Colors.accent,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sliderWrapper: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'visible',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    marginLeft: -8,
    ...Shadows.glow(Colors.accent),
  },
  nativeSliderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
  },
  sliderMin: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  sliderMax: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  sliderHint: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  adjustButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  adjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Settings rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  settingDesc: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  // Toggle
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {},
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.textTertiary,
  },
  toggleThumbActive: {
    backgroundColor: Colors.accent,
    ...Shadows.glow(Colors.accent),
  },
  // Input
  inputLabel: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    padding: 0,
  },
  // Danger
  dangerDescription: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  // About
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  aboutLabel: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  aboutValue: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  // Language Select
  languageSelectContainer: {
    paddingVertical: 4,
  },
  horizontalScroll: {
    gap: 8,
    paddingRight: 10,
  },
  langBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  langBadgeActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderColor: Colors.accent,
    ...Shadows.glow(Colors.accentDim),
  },
  langBadgeText: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  langBadgeTextActive: {
    color: Colors.accent,
    ...Typography.bodySemiBold,
  },
});
