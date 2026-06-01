import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import FaceOvalGuide from '../components/camera/FaceOvalGuide';
import LandmarkDots from '../components/camera/LandmarkDots';
import LightingIndicator from '../components/camera/LightingIndicator';
import AnimatedButton from '../components/ui/AnimatedButton';
import GlassCard from '../components/ui/GlassCard';
import CameraView from '../components/camera/CameraView';
import ArchitectureIcon from '../components/ui/ArchitectureIcons';
import { Colors, Typography, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { storageService } from '../services/storageService';
import { sqliteService } from '../services/sqliteService';
import { modelLoader } from '../src/engine/modelLoader';
import { frameProcessorEngine } from '../src/engine/frameProcessor';
import { EmbeddingValidator } from '../src/engine/embeddingValidator';
import { FaceMeshModule } from '../src/engine/faceMeshModule';
import { matchEmbedding } from '../src/engine/matcher';
import { t, getLocale, setLocale, addLocaleListener } from '../services/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = 1 | 2 | 3 | 4; // 1: Position, 2: Blink, 3: Confirm, 4: Success

interface LanguageOption {
  id: string;
  language: string;
  nativeLanguage: string;
  state: string;
  monumentName: string;
  iconName: any;
  iconColor: string;
}

const LANGUAGES: LanguageOption[] = [
  {
    id: 'en',
    language: 'English',
    nativeLanguage: 'English',
    state: 'Global Interface',
    monumentName: 'Parliament',
    iconName: 'temple-gopuram',
    iconColor: '#FFFFFF',
  },
  {
    id: 'hi',
    language: 'Hindi',
    nativeLanguage: 'हिंदी',
    state: 'Delhi / North India',
    monumentName: 'Taj Mahal',
    iconName: 'taj-mahal',
    iconColor: '#FF9933',
  },
  {
    id: 'mr',
    language: 'Marathi',
    nativeLanguage: 'मराठी',
    state: 'Maharashtra',
    monumentName: 'Gateway of India',
    iconName: 'gateway-of-india',
    iconColor: '#00D4FF',
  },
  {
    id: 'ta',
    language: 'Tamil',
    nativeLanguage: 'தமிழ்',
    state: 'Tamil Nadu',
    monumentName: 'Brihadisvara Temple',
    iconName: 'temple-gopuram',
    iconColor: '#7C5CFC',
  },
  {
    id: 'kn',
    language: 'Kannada',
    nativeLanguage: 'ಕನ್ನಡ',
    state: 'Karnataka',
    monumentName: 'Stone Chariot',
    iconName: 'stone-chariot',
    iconColor: '#00FF88',
  },
  {
    id: 'te',
    language: 'Telugu',
    nativeLanguage: 'తెలుగు',
    state: 'Telangana & AP',
    monumentName: 'Charminar',
    iconName: 'charminar',
    iconColor: '#FFB800',
  },
  {
    id: 'bn',
    language: 'Bengali',
    nativeLanguage: 'বাংলা',
    state: 'West Bengal',
    monumentName: 'Howrah Bridge',
    iconName: 'howrah-bridge',
    iconColor: '#FF3B5C',
  },
  {
    id: 'gu',
    language: 'Gujarati',
    nativeLanguage: 'ગુજરાતી',
    state: 'Gujarat',
    monumentName: 'Statue of Unity',
    iconName: 'statue-of-unity',
    iconColor: '#FF8000',
  },
  {
    id: 'ml',
    language: 'Malayalam',
    nativeLanguage: 'മലയാളം',
    state: 'Kerala',
    monumentName: 'Houseboat',
    iconName: 'houseboat',
    iconColor: '#00E5FF',
  },
  {
    id: 'pa',
    language: 'Punjabi',
    nativeLanguage: 'ਪੰਜਾਬੀ',
    state: 'Punjab',
    monumentName: 'Golden Temple',
    iconName: 'golden-temple',
    iconColor: '#FFD700',
  }
];

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: Array<{ label: string; icon: any; instruction: string }> }) {
  return (
    <View style={styles.stepContainer}>
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
            )}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isCompleted && styles.stepDotCompleted,
                ]}
              >
                {isCompleted ? (
                  <MaterialCommunityIcons name="check" size={14} color={Colors.background} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      (isActive || isCompleted) && styles.stepNumberActive,
                    ]}
                  >
                    {stepNum}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
                {step.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function SuccessOverlay({ onDone, name }: { onDone: () => void; name: string }) {
  return (
    <View style={styles.successOverlay}>
      <LinearGradient
        colors={['rgba(0, 255, 136, 0.05)', 'rgba(0, 255, 136, 0.02)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.successCircle}>
        <MaterialCommunityIcons name="check" size={48} color={Colors.background} />
      </Animated.View>
      <Animated.Text entering={FadeInUp.delay(300).duration(600)} style={styles.successTitle}>
        {t('regSuccessTitle')}
      </Animated.Text>
      <Animated.Text entering={FadeInUp.delay(500).duration(600)} style={styles.successSubtitle}>
        {name} {t('regSuccessDesc')}
      </Animated.Text>
      <Animated.View entering={FadeInUp.delay(700).duration(600)} style={styles.successButton}>
        <AnimatedButton label={t('save')} onPress={onDone} variant="success" icon="check-circle" />
      </Animated.View>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();

  // Registration States
  const [enrollName, setEnrollName] = useState('');
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(t('initModels'));

  // Language & UI states
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [locale, setLocaleState] = useState(getLocale());

  // Camera & Face States
  const [faceDetected, setFaceDetected] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [realPoints, setRealPoints] = useState<{ x: number; y: number }[] | undefined>(undefined);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [qualityPrompt, setQualityPrompt] = useState<string>(t('detectingFace'));
  const [debugText, setDebugText] = useState<string>('Console initialized. Awaiting name input...');
  const [lightingScore, setLightingScore] = useState(100);
  const [lightingIssue, setLightingIssue] = useState<string | null>(null);

  // Animation progress
  const progressWidth = useSharedValue(0);

  // References for processing
  const isProcessing = useRef(false);
  const stableCount = useRef(0);
  const captureStartedAt = useRef<number | null>(null);
  const savedUserId = useRef<string | null>(null);
  const extraCaptureCount = useRef(0);
  const validatorRef = useRef(new EmbeddingValidator(5, 0.40));
  const validationFailCount = useRef(0);

  // Load AI Models on mount
  useEffect(() => {
    frameProcessorEngine.resetLiveness();
    modelLoader
      .loadAll((step, total, label) => {
        setLoadingStatus(`${label} (${step}/${total})`);
        setDebugText(`Model loader: ${label} (${step}/${total})`);
      })
      .then(() => {
        setModelsLoaded(true);
        setDebugText('Mock models initialized. Ready to proceed.');
      })
      .catch(err => {
        console.error('Model loading failed:', err);
        setLoadingStatus('AI model initialization failed. Retry.');
        setDebugText(`Model loader error: ${err.message}`);
      });
  }, []);

  // Update locale
  useEffect(() => {
    return addLocaleListener(() => {
      setLocaleState(getLocale());
    });
  }, []);

  // Update progress bar width based on current step
  useEffect(() => {
    if (currentStep === 1) {
      progressWidth.value = withTiming(33, { duration: 500 });
    } else if (currentStep === 2) {
      progressWidth.value = withTiming(66, { duration: 500 });
    } else if (currentStep === 3) {
      progressWidth.value = withTiming(95, { duration: 500 });
    } else if (currentStep === 4) {
      progressWidth.value = withTiming(100, { duration: 500 });
    }
  }, [currentStep]);

  // Frame processing loop
  const handleFrame = useCallback(async (frame: Uint8Array) => {
    if (isProcessing.current) return;
    if (currentStep >= 4 && extraCaptureCount.current >= 3) return;
    isProcessing.current = true;

    try {
      const process = await frameProcessorEngine.processForEmbedding(frame, (msg) => {
        setDebugText(msg);
      });
      console.log('[FaceGate][Register] timing(ms)', process.timing);
      if (!process.faceFound || !process.embedding) {
        setFaceDetected(false);
        setShowLandmarks(false);
        setRealPoints(undefined);
        setFaceBox(null);
        setQualityPrompt(t('detectingFace'));
        return;
      }

      setFaceDetected(true);
      setShowLandmarks(true);
      setRealPoints(process.landmarks?.map(p => ({ x: p.x * 280, y: p.y * 370 })) ?? []);

      if (process.detection) {
        const boxWidth = process.detection.width * 280;
        const boxX = process.detection.x * 280;
        setFaceBox({
          x: 280 - boxX - boxWidth, // Mirror X coordinate for mirrored preview
          y: process.detection.y * 370,
          width: boxWidth,
          height: process.detection.height * 370,
        });
      }

      // Update lighting states
      setLightingScore(process.lightingScore ?? 100);
      setLightingIssue(process.lightingIssue ?? null);

      if (process.lightingScore !== undefined && process.lightingScore < 60) {
        const getLightingMessage = (issue: string | null) => {
          if (issue === 'too_dark') return "Too dark, move to better light";
          if (issue === 'too_bright') return "Too bright, avoid direct sunlight";
          if (issue === 'shadow') return "Shadow detected, adjust position";
          if (issue === 'backlight') return "Avoid light source behind you";
          return "Poor lighting quality";
        };
        setQualityPrompt(getLightingMessage(process.lightingIssue ?? null));
        return;
      }

      if (savedUserId.current) {
        if (extraCaptureCount.current < 3) {
          storageService.saveExtraFaceEmbedding(savedUserId.current, process.embedding);
          extraCaptureCount.current += 1;
          console.log('[FaceGate][Register] Extra embedding', extraCaptureCount.current, 'saved');
        }
        if (extraCaptureCount.current >= 3) {
          setCurrentStep(4);
        }
        return;
      }

      // --- Quality-gated multi-frame accumulation ---
      const ear = process.ear ?? 0.3;
      const faceAngle = process.faceAngle ?? 0;
      const regQuality = FaceMeshModule.getRegistrationQuality(
        {
          score: process.detection?.score ?? 0,
          width: process.detection?.width ?? 0,
          height: process.detection?.height ?? 0,
        },
        faceAngle,
        ear
      );

      if (!regQuality.pass) {
        setQualityPrompt(regQuality.message ?? 'Adjust position for better capture.');
        return;
      }

      const validator = validatorRef.current;
      const isFull = validator.add(process.embedding);
      const collected = validator.count;
      const needed = validator.required;
      setQualityPrompt(`${t('regPromptCapturingCenter')} (${collected}/${needed})`);
      setDebugText(`High-quality frame ${collected}/${needed} captured.`);

      if (!isFull) return;

      const result = validator.validate();
      console.log('[FaceGate][Register] Validation:', result.message, 'avgDist:', result.avgDistance.toFixed(4));

      if (!result.consistent || !result.centroid) {
        validationFailCount.current += 1;
        validator.reset();
        if (validationFailCount.current >= 3) {
          setQualityPrompt('Having trouble capturing. Ensure good lighting and hold very still.');
        } else {
          setQualityPrompt('Captures were inconsistent. Hold still and try again...');
        }
        setDebugText(`Consistency check failed (attempt ${validationFailCount.current}). Retrying...`);
        return;
      }

      const existingUsers = storageService.getUsers();
      const existingUser = existingUsers.find(
        u => u.name.toLowerCase().trim() === enrollName.toLowerCase().trim()
      );
      const threshold = storageService.getSettings().threshold;

      if (existingUser) {
        const userGallery = storageService
          .getFaceEmbeddingsAsGallery()
          .filter(e => e.userId === existingUser.id);
        
        if (userGallery.length > 0) {
          const match = matchEmbedding(result.centroid, userGallery, threshold, 0.08);
          if (!match.matched) {
            alert("Identity verification failed. Scanned face does not match the registered profile for this name.");
            setQualityPrompt('Identity mismatch! Scanned face is different from the registered user.');
            setDebugText('Identity verification failed. Scanned face mismatch.');
            
            validatorRef.current.reset();
            setHasEnteredName(false);
            setCurrentStep(1);
            return;
          }
        }
      }

      const existing = storageService.getFaceEmbeddings();
      let nextNumId = 100;
      if (existing.length > 0) {
        const ids = existing.map(e => {
          const parsed = Number(e.userId.replace('user_', ''));
          return isNaN(parsed) ? 0 : parsed;
        });
        const maxId = Math.max(...ids, 99);
        nextNumId = maxId + 1;
      }
      const userId = existingUser ? existingUser.id : `user_${nextNumId}`;
      const registeredAt = new Date().toISOString();
      const vectorArray = Array.from(result.centroid);
      storageService.saveUser({
        id: userId,
        name: enrollName.trim() || 'New User',
        registeredAt: registeredAt.split('T')[0],
        status: 'active',
        descriptor: vectorArray,
      });
      storageService.saveFaceEmbedding({
        userId,
        name: enrollName.trim() || 'New User',
        vector: result.centroid,
        registeredAt,
      });
      sqliteService.saveEmbedding(userId, enrollName.trim() || 'New User', result.centroid, registeredAt);
      storageService.addLog({
        name: enrollName.trim() || 'New User',
        timestamp: 'Just now',
        status: 'success',
        confidence: 100,
      });
      savedUserId.current = userId;
      extraCaptureCount.current = 0;
      validationFailCount.current = 0;
      setQualityPrompt('Saving multi-angle templates...');
    } catch (e: any) {
      console.warn('Register processing loop error:', e);
      setDebugText(`Processing loop error: ${e.message}`);
    } finally {
      isProcessing.current = false;
    }
  }, [currentStep, enrollName]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handleStartScan = () => {
    if (enrollName.trim().length >= 2) {
      frameProcessorEngine.resetLiveness();
      setHasEnteredName(true);
    }
  };

  const localizedSteps = [
    {
      label: t('regStageCenterLabelShort'),
      icon: 'face-recognition' as const,
      instruction: t('regPromptLookStraight'),
    },
    {
      label: t('authenticate'),
      icon: 'eye-outline' as const,
      instruction: t('scanSubtitle'),
    },
    {
      label: t('save'),
      icon: 'check-circle-outline' as const,
      instruction: t('regPromptStoringBiometrics'),
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Tech Grid */}
      <LinearGradient colors={['#0A0F1E', '#111B33', '#0A1020']} style={StyleSheet.absoluteFill} />
      <View style={styles.gridOverlay}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={`h${i}`}
            style={[styles.gridLine, { top: `${(i + 1) * 11}%`, width: '100%', height: 1 }]}
          />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={`v${i}`}
            style={[styles.gridLine, { left: `${(i + 1) * 16.6}%`, height: '100%', width: 1 }]}
          />
        ))}
      </View>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>{t('regTitle')}</Text>
        <Pressable 
          onPress={() => setShowLanguageSelect(true)} 
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="translate" size={22} color={Colors.accent} />
        </Pressable>
      </View>

      {/* 0. LANGUAGE SELECTION MODAL */}
      {showLanguageSelect && (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.inputForm}>
          <GlassCard padding={16}>
            <Text style={styles.languageHeaderTitle}>{t('selectLocale')}</Text>
            <Text style={styles.languageHeaderSubtitle}>
              {t('selectLocaleDesc')}
            </Text>

            <ScrollView 
              style={styles.languageList} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.languageListContent}
            >
              <View style={styles.gridRow}>
                {LANGUAGES.map((lang) => {
                  const isSelected = getLocale() === lang.id;
                  return (
                    <Pressable
                      key={lang.id}
                      onPress={() => {
                        setLocale(lang.id);
                        setTimeout(() => {
                          setShowLanguageSelect(false);
                        }, 250);
                      }}
                      style={({ pressed }) => [
                        styles.langGridItem,
                        isSelected && styles.langGridItemActive,
                        pressed && { transform: [{ scale: 0.98 }] }
                      ]}
                    >
                      <View style={styles.langItemContent}>
                        <View style={[styles.langIconContainer, { backgroundColor: lang.iconColor + '12' }]}>
                          <ArchitectureIcon name={lang.iconName} color={lang.iconColor} size={20} />
                        </View>
                        <View style={styles.langTextContainer}>
                          <Text style={styles.langNativeName}>{lang.nativeLanguage}</Text>
                          <Text style={styles.langName}>{lang.language}</Text>
                          <Text style={styles.langState} numberOfLines={1}>{lang.state}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            
            <AnimatedButton
              label={t('back')}
              onPress={() => setShowLanguageSelect(false)}
              variant="ghost"
              icon="arrow-left"
              style={{ marginTop: 16 }}
            />
          </GlassCard>
        </Animated.View>
      )}

      {/* STEP 0: NAME ENROLLMENT INPUT */}
      {!hasEnteredName && !showLanguageSelect && (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.inputForm}>
          <GlassCard padding={24}>
            <View style={styles.formIcon}>
              <MaterialCommunityIcons name="account-key-outline" size={48} color={Colors.accent} />
            </View>
            <Text style={styles.formTitle}>{t('biometricEnrollmentTitle')}</Text>
            <Text style={styles.formSubtitle}>{t('regSubtitle')}</Text>

            <TextInput
              style={styles.nameInput}
              placeholder={t('regNamePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={enrollName}
              onChangeText={setEnrollName}
              maxLength={40}
            />

            <AnimatedButton
              label={modelsLoaded ? t('regInitScanner') : t('loadingModels')}
              onPress={handleStartScan}
              disabled={!modelsLoaded || enrollName.trim().length < 2}
              variant="primary"
              icon="face-recognition"
              style={{ marginTop: 24 }}
            />

            {!modelsLoaded && (
              <Text style={styles.loadingStatusText}>{loadingStatus}</Text>
            )}
          </GlassCard>
        </Animated.View>
      )}

      {/* REAL CAMERA ENROLLMENT LAYOUT */}
      {hasEnteredName && currentStep < 4 && !showLanguageSelect && (
        <View style={styles.cameraArea}>
          <View style={styles.cameraFrameWrapper}>
            <CameraView active={currentStep < 4} onFrame={handleFrame} />
            {/* Guide overlay */}
            <FaceOvalGuide
              detected={faceDetected}
              width={faceBox ? faceBox.width : 220}
              height={faceBox ? faceBox.height : 300}
              x={faceBox ? faceBox.x : undefined}
              y={faceBox ? faceBox.y : undefined}
            />
            {/* Landmark overlay */}
            <LandmarkDots visible={showLandmarks} width={280} height={370} points={realPoints} />
          </View>
        </View>
      )}

      {/* SUCCESS CARD */}
      {hasEnteredName && currentStep === 4 && !showLanguageSelect && (
        <SuccessOverlay onDone={() => router.back()} name={enrollName} />
      )}

      {/* STEPS BOTTOM PANEL */}
      {hasEnteredName && currentStep < 4 && !showLanguageSelect && (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.bottomSheet}>
          <View style={styles.handle} />

          <StepIndicator currentStep={currentStep} steps={localizedSteps} />

          <View style={styles.instructionCard}>
            <MaterialCommunityIcons
              name={localizedSteps[currentStep - 1].icon}
              size={22}
              color={Colors.accent}
            />
            <Text style={styles.instructionText}>
              {qualityPrompt || localizedSteps[currentStep - 1].instruction}
            </Text>
          </View>

          <LightingIndicator score={lightingScore} issue={lightingIssue} />

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <Text style={styles.progressLabel}>
              {t('regTitle')} ({currentStep}/3)
            </Text>
          </View>
        </Animated.View>
      )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...Typography.headingMedium,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
  },
  inputForm: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 5,
  },
  formIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: Colors.borderAccent,
  },
  formTitle: {
    ...Typography.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md,
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Typography.body,
  },
  loadingStatusText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: 12,
  },
  cameraArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  cameraFrameWrapper: {
    width: 280,
    height: 370,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.borderAccent,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.glow(Colors.accentDim),
  },
  bottomSheet: {
    backgroundColor: Colors.backgroundLight,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.glassBorder,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center',
    marginBottom: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  stepDotCompleted: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: Colors.textTertiary,
    opacity: 0.3,
    marginHorizontal: 4,
    marginBottom: 22,
  },
  stepLineActive: {
    backgroundColor: Colors.success,
    opacity: 1,
  },
  stepNumber: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  stepNumberActive: {
    color: Colors.accent,
  },
  stepLabel: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  stepLabelActive: {
    color: Colors.accent,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  instructionText: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  progressContainer: {
    gap: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressLabel: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow(Colors.success),
    marginBottom: 24,
  },
  successTitle: {
    ...Typography.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.success,
    marginBottom: 8,
  },
  successSubtitle: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successButton: {
    width: '100%',
    marginTop: 32,
  },
  languageHeaderTitle: {
    ...Typography.heading,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  languageHeaderSubtitle: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  languageList: {
    maxHeight: 280,
  },
  languageListContent: {
    paddingBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  langGridItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md,
    padding: 6,
    marginBottom: 6,
  },
  langGridItemActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    ...Shadows.glow(Colors.accentDim),
  },
  langItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTextContainer: {
    flex: 1,
  },
  langNativeName: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },
  langName: {
    ...Typography.body,
    fontSize: 9,
    color: Colors.textSecondary,
  },
  langState: {
    ...Typography.body,
    fontSize: 7,
    color: Colors.textTertiary,
    marginTop: 0.5,
  },
});
