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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolateColor,
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
import { euclideanDistance } from '../src/engine/matcher';
import { t, getLocale, setLocale, addLocaleListener } from '../services/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RegisterStage = 'name-input' | 'scan-center' | 'scan-left' | 'scan-right' | 'scan-smile' | 'success';

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

const STAGES = [
  { key: 'scan-center', labelKey: 'regStageCenterLabel', instructionKey: 'regStageCenterDesc' },
  { key: 'scan-left', labelKey: 'regStageLeftLabel', instructionKey: 'regStageLeftDesc' },
  { key: 'scan-right', labelKey: 'regStageRightLabel', instructionKey: 'regStageRightDesc' },
  { key: 'scan-smile', labelKey: 'regStageSmileLabel', instructionKey: 'regStageSmileDesc' },
];

// --- HUD Guidance Helper Components ---

function HudArrowLeft() {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(-30, { duration: 1000, easing: Easing.bezier(0.25, 1, 0.5, 1) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.2, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.hudArrowWrapperLeft} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons name="chevron-double-left" size={54} color="#00D4FF" />
      </Animated.View>
    </View>
  );
}

function HudArrowRight() {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(30, { duration: 1000, easing: Easing.bezier(0.25, 1, 0.5, 1) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.2, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.hudArrowWrapperRight} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons name="chevron-double-right" size={54} color="#00D4FF" />
      </Animated.View>
    </View>
  );
}

function HudTargetLock() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.hudCorner, styles.hudCornerTL]} />
      <View style={[styles.hudCorner, styles.hudCornerTR]} />
      <View style={[styles.hudCorner, styles.hudCornerBL]} />
      <View style={[styles.hudCorner, styles.hudCornerBR]} />
      
      <Animated.View style={[styles.hudRadarRing, style]}>
        <View style={styles.hudRadarLineHorizontal} />
        <View style={styles.hudRadarLineVertical} />
      </Animated.View>
    </View>
  );
}

function HudSmileArc({ active }: { active: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      opacity.value = withTiming(1.0, { duration: 300 });
    } else {
      scale.value = 1;
      opacity.value = withTiming(0.5, { duration: 300 });
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.hudSmileArcContainer} pointerEvents="none">
      <Animated.View style={[styles.hudSmileBubble, active && styles.hudSmileBubbleActive, animatedStyle]}>
        <MaterialCommunityIcons 
          name="emoticon-happy-outline" 
          size={36} 
          color={active ? "#00FF88" : "#00D4FF"} 
        />
        <Text style={[styles.hudSmileText, active && styles.hudSmileTextActive]}>
          {active ? t('regPromptSmileDetected').toUpperCase() : t('regPromptSmile').toUpperCase()}
        </Text>
      </Animated.View>
    </View>
  );
}

function StageChecklist({ 
  currentStage, 
  completedCenter, 
  completedLeft, 
  completedRight, 
  completedSmile 
}: { 
  currentStage: RegisterStage; 
  completedCenter: boolean; 
  completedLeft: boolean; 
  completedRight: boolean; 
  completedSmile: boolean; 
}) {
  const steps = [
    { key: 'scan-center', done: completedCenter, labelKey: 'regStageCenterLabelShort', fallback: 'Center' },
    { key: 'scan-left', done: completedLeft, labelKey: 'regStageLeftLabelShort', fallback: 'Left' },
    { key: 'scan-right', done: completedRight, labelKey: 'regStageRightLabelShort', fallback: 'Right' },
    { key: 'scan-smile', done: completedSmile, labelKey: 'regStageSmileLabelShort', fallback: 'Smile' },
  ];

  return (
    <View style={styles.checklistContainer}>
      <View style={styles.checklistLineTrack} />
      
      <View style={styles.checklistRow}>
        {steps.map((step, idx) => {
          const isActive = currentStage === step.key;
          const isDone = step.done;
          
          return (
            <View key={step.key} style={styles.checklistItem}>
              <View style={[
                styles.checklistCircle,
                isActive && styles.checklistCircleActive,
                isDone && styles.checklistCircleDone
              ]}>
                {isDone ? (
                  <MaterialCommunityIcons name="check-bold" size={14} color="#0A0F1E" />
                ) : isActive ? (
                  <View style={styles.checklistCircleActiveInner} />
                ) : (
                  <Text style={styles.checklistCircleText}>{idx + 1}</Text>
                )}
              </View>
              <Text style={[
                styles.checklistLabel,
                isActive && styles.checklistLabelActive,
                isDone && styles.checklistLabelDone
              ]}>
                {t(step.labelKey)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function RegisterPortalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phoneParam = (params.phone as string) || '';

  // Registration identity
  const [enrollName, setEnrollName] = useState('');
  const [enrollPhone, setEnrollPhone] = useState(phoneParam);
  const [stage, setStage] = useState<RegisterStage>('name-input');
  const [loadingStatus, setLoadingStatus] = useState(t('initModels'));
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Language & UI states
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [locale, setLocaleState] = useState(getLocale());
  const [poseIsValid, setPoseIsValid] = useState(false);
  const [smileActive, setSmileActive] = useState(false);

  // Camera & Face states
  const [faceDetected, setFaceDetected] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [realPoints, setRealPoints] = useState<{ x: number; y: number }[] | undefined>(undefined);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [qualityPrompt, setQualityPrompt] = useState<string>(t('detectingFace'));
  const [debugText, setDebugText] = useState<string>('Console initialized.');
  const [lightingScore, setLightingScore] = useState(100);
  const [lightingIssue, setLightingIssue] = useState<string | null>(null);

  // Animation values
  const progressWidth = useSharedValue(0);
  const glowProgress = useSharedValue(0);

  // Captured embedding buffers
  const embeddingCenter = useRef<Float32Array | null>(null);
  const embeddingLeft = useRef<Float32Array | null>(null);
  const embeddingRight = useRef<Float32Array | null>(null);
  const embeddingSmile = useRef<Float32Array | null>(null);
  const centerValidatorRef = useRef(new EmbeddingValidator(3, 0.40));

  // Flow control references
  const isProcessing = useRef(false);
  const consecutiveValidFrames = useRef(0);
  const requiredValidFrames = 2; // hold pose for 2 frames to ensure quality capture

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
        setDebugText('Mock models initialized. Ready.');
      })
      .catch(err => {
        console.error('Model loading failed:', err);
        setLoadingStatus('AI model initialization failed. Retry.');
        setDebugText(`Model loading error: ${err.message}`);
      });
  }, []);

  // Update progress bar
  useEffect(() => {
    let targetProgress = 0;
    if (stage === 'scan-center') targetProgress = 25;
    else if (stage === 'scan-left') targetProgress = 50;
    else if (stage === 'scan-right') targetProgress = 75;
    else if (stage === 'scan-smile') targetProgress = 95;
    else if (stage === 'success') targetProgress = 100;
    progressWidth.value = withTiming(targetProgress, { duration: 500 });
  }, [stage]);

  // Update border glow
  useEffect(() => {
    glowProgress.value = withTiming(poseIsValid ? 1 : 0, { duration: 355 });
  }, [poseIsValid]);

  // Update locale
  useEffect(() => {
    return addLocaleListener(() => {
      setLocaleState(getLocale());
    });
  }, []);

  // Frame processing loop
  const handleFrame = useCallback(async (frame: Uint8Array) => {
    if (isProcessing.current || stage === 'name-input' || stage === 'success') return;
    isProcessing.current = true;

    try {
      const process = await frameProcessorEngine.processForEmbedding(frame, (msg) => {
        setDebugText(msg);
      });

      if (!process.faceFound || !process.embedding) {
        setFaceDetected(false);
        setShowLandmarks(false);
        setRealPoints(undefined);
        setFaceBox(null);
        setQualityPrompt(t('noFaceDetected'));
        setPoseIsValid(false);
        setSmileActive(false);
        return;
      }

      setFaceDetected(true);
      setShowLandmarks(true);
      setRealPoints(process.landmarks?.map(p => ({ x: p.x * 260, y: p.y * 340 })) ?? []);

      if (process.detection) {
        const boxWidth = process.detection.width * 260;
        const boxX = process.detection.x * 260;
        setFaceBox({
          x: 260 - boxX - boxWidth, // Mirror X coordinate for mirrored preview
          y: process.detection.y * 340,
          width: boxWidth,
          height: process.detection.height * 340,
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
        setPoseIsValid(false);
        setSmileActive(false);
        return;
      }

      // 1. Check pose parameters based on the current stage
      const liveness = process.livenessSignal;
      let isPoseValid = false;
      let prompt = '';

      if (stage === 'scan-center') {
        const headNeutral = !liveness?.headTurnLeftDetected && !liveness?.headTurnRightDetected;
        const noSmile = !liveness?.smileDetected;
        
        if (headNeutral && noSmile) {
          isPoseValid = true;
          prompt = t('regPromptHoldCenter');
        } else if (!headNeutral) {
          prompt = t('regPromptLookStraight');
        } else {
          prompt = t('regPromptNoSmile');
        }
      } 
      
      else if (stage === 'scan-left') {
        if (liveness?.headTurnLeftDetected) {
          isPoseValid = true;
          prompt = t('regPromptHoldLeft');
        } else {
          prompt = t('regPromptTurnLeft');
        }
      } 
      
      else if (stage === 'scan-right') {
        if (liveness?.headTurnRightDetected) {
          isPoseValid = true;
          prompt = t('regPromptHoldRight');
        } else {
          prompt = t('regPromptTurnRight');
        }
      } 
      
      else if (stage === 'scan-smile') {
        const smiling = !!liveness?.smileDetected;
        
        if (smiling) {
          isPoseValid = true;
          prompt = t('regPromptSmileDetected');
        } else {
          prompt = t('regPromptSmile');
        }
      }

      // Quality-gate center pose
      if (isPoseValid && stage === 'scan-center') {
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
          prompt = regQuality.message ?? 'Adjust position for center capture.';
          isPoseValid = false;
        }
      }

      setQualityPrompt(prompt);
      
      // Update matching states for UI indicators
      if (poseIsValid !== isPoseValid) {
        setPoseIsValid(isPoseValid);
      }
      const smiling = !!liveness?.smileDetected;
      if (smileActive !== smiling) {
        setSmileActive(smiling);
      }

      // 2. Accumulate valid frames to capture embedding
      if (isPoseValid) {
        if (stage === 'scan-center') {
          const validator = centerValidatorRef.current;
          const isFull = validator.add(process.embedding);
          const collected = validator.count;
          const needed = validator.required;
          setQualityPrompt(`${t('regPromptCapturingCenter')} (${collected}/${needed})`);
          setDebugText(`Center frame ${collected}/${needed} captured.`);

          if (isFull) {
            const result = validator.validate();
            console.log('[FaceGate][RegisterPortal] Center validation:', result.message, 'avgDist:', result.avgDistance.toFixed(4));
            if (result.consistent && result.centroid) {
              embeddingCenter.current = result.centroid;
              setStage('scan-left');
              setPoseIsValid(false);
              consecutiveValidFrames.current = 0;
            } else {
              validator.reset();
              setQualityPrompt('Center captures were inconsistent. Hold still and try again.');
              setDebugText('Center consistency check failed. Retrying center pose...');
            }
          }
        } else {
          consecutiveValidFrames.current += 1;
          setDebugText(`Pose valid! Hold: ${consecutiveValidFrames.current}/${requiredValidFrames}`);

          if (consecutiveValidFrames.current >= requiredValidFrames) {
            if (stage === 'scan-left') {
              embeddingLeft.current = process.embedding;
              setStage('scan-right');
              setPoseIsValid(false);
            } else if (stage === 'scan-right') {
              embeddingRight.current = process.embedding;
              setStage('scan-smile');
              setPoseIsValid(false);
            } else if (stage === 'scan-smile') {
              embeddingSmile.current = process.embedding;
              await completeRegistration();
            }
            consecutiveValidFrames.current = 0;
          }
        }
      } else {
        if (stage !== 'scan-center') {
          consecutiveValidFrames.current = 0;
        }
      }
    } catch (e: any) {
      console.warn('Guided registration error:', e);
      setDebugText(`Scan error: ${e.message}`);
    } finally {
      isProcessing.current = false;
    }
  }, [stage, poseIsValid, smileActive]);

  // Complete and save user registration details
  const completeRegistration = async () => {
    if (
      !embeddingCenter.current ||
      !embeddingLeft.current ||
      !embeddingRight.current ||
      !embeddingSmile.current
    ) {
      setDebugText('Biometric collection incomplete. Scans failed.');
      setStage('name-input');
      return;
    }

    const distLeft = euclideanDistance(embeddingCenter.current, embeddingLeft.current);
    const distRight = euclideanDistance(embeddingCenter.current, embeddingRight.current);
    const distSmile = euclideanDistance(embeddingCenter.current, embeddingSmile.current);

    console.log('[FaceGate][RegisterPortal] Cross-distances:', { distLeft, distRight, distSmile });

    if (distLeft > 1.0 || distRight > 1.0 || distSmile > 1.0) {
      setDebugText(`Cross-validation failed. Pose distances too high. (Left: ${distLeft.toFixed(2)}, Right: ${distRight.toFixed(2)}, Smile: ${distSmile.toFixed(2)})`);
      setQualityPrompt(t('regPromptValidationFailed'));
      
      embeddingCenter.current = null;
      embeddingLeft.current = null;
      embeddingRight.current = null;
      embeddingSmile.current = null;
      centerValidatorRef.current.reset();
      consecutiveValidFrames.current = 0;
      setPoseIsValid(false);
      setStage('scan-center');
      return;
    }

    try {
      setDebugText(t('regPromptStoringBiometrics'));
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
      const userId = `user_${nextNumId}`;
      const registeredAt = new Date().toISOString();

      storageService.saveUser({
        id: userId,
        phone: enrollPhone,
        name: enrollName.trim() || 'Attendee',
        registeredAt: registeredAt.split('T')[0],
        status: 'active',
        descriptor: Array.from(embeddingCenter.current),
      });

      storageService.saveFaceEmbedding({
        userId,
        name: enrollName.trim() || 'Attendee',
        vector: embeddingCenter.current,
        registeredAt,
      });

      storageService.saveExtraFaceEmbedding(userId, embeddingLeft.current);
      storageService.saveExtraFaceEmbedding(userId, embeddingRight.current);
      storageService.saveExtraFaceEmbedding(userId, embeddingSmile.current);

      sqliteService.saveEmbedding(
        userId,
        enrollName.trim() || 'Attendee',
        embeddingCenter.current,
        registeredAt
      );

      storageService.addLog({
        name: enrollName.trim() || 'Attendee',
        timestamp: 'Just now',
        status: 'success',
        confidence: 100,
      });

      storageService.setLoggedInUser({
        id: userId,
        phone: enrollPhone,
        name: enrollName.trim(),
        registeredAt: registeredAt.split('T')[0],
        status: 'active',
      });

      setStage('success');
      setDebugText('Registration complete. Biometrics stored.');
    } catch (e: any) {
      console.error('Failed to complete registration:', e);
      setDebugText(`Database storage failed: ${e.message}`);
    }
  };

  const handleStartScan = () => {
    if (enrollName.trim().length >= 2 && enrollPhone.length >= 10) {
      const existingUsers = storageService.getUsers();
      
      const dupName = existingUsers.some(
        u => u.name.toLowerCase().trim() === enrollName.toLowerCase().trim()
      );
      if (dupName) {
        alert("A user with this name already exists. Please choose a unique name.");
        return;
      }

      const dupPhone = existingUsers.some(
        u => u.phone && u.phone.trim() === enrollPhone.trim()
      );
      if (dupPhone) {
        alert("A user with this mobile number already exists. Please enter a unique number.");
        return;
      }

      setStage('scan-center');
      frameProcessorEngine.resetLiveness();
      consecutiveValidFrames.current = 0;
      centerValidatorRef.current.reset();
    }
  };

  const handleDone = () => {
    router.replace('/(tabs)');
  };

  const currentStageIndex = STAGES.findIndex(s => s.key === stage);
  const activeStage = currentStageIndex > -1 ? STAGES[currentStageIndex] : null;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const animatedCameraFrameStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      glowProgress.value,
      [0, 1],
      [Colors.borderAccent, '#00FF88']
    );
    const shadowColor = interpolateColor(
      glowProgress.value,
      [0, 1],
      ['rgba(0, 212, 255, 0.2)', 'rgba(0, 255, 136, 0.4)']
    );
    return {
      borderColor,
      shadowColor,
      shadowOpacity: 0.8,
      shadowRadius: 10,
    };
  });

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

      {/* 1. INITIAL NAME INPUT */}
      {stage === 'name-input' && !showLanguageSelect && (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.inputForm}>
          <GlassCard padding={24}>
            <View style={styles.formIcon}>
              <MaterialCommunityIcons name="account-plus-outline" size={44} color={Colors.accent} />
            </View>
            <Text style={styles.formTitle}>{t('biometricEnrollmentTitle')}</Text>
            <Text style={styles.formSubtitle}>
              {t('regSubtitle')} +91 {enrollPhone.replace('+91', '')}
            </Text>

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
          </GlassCard>
        </Animated.View>
      )}

      {/* 2. CAMERA POSE GUIDANCE FLOW */}
      {stage !== 'name-input' && stage !== 'success' && !showLanguageSelect && activeStage && (
        <View style={styles.cameraFlowContainer}>
          {/* Futuristic horizontal checklist */}
          <StageChecklist
            currentStage={stage}
            completedCenter={!!embeddingCenter.current}
            completedLeft={!!embeddingLeft.current}
            completedRight={!!embeddingRight.current}
            completedSmile={!!embeddingSmile.current}
          />

          <View style={styles.stageIndicatorWrapper}>
            <Text style={styles.stageTitle}>
              {t(`regStage${stage === 'scan-center' ? 'Center' : stage === 'scan-left' ? 'Left' : stage === 'scan-right' ? 'Right' : 'Smile'}Label`)}
            </Text>
            <Text style={styles.stageInstruction}>
              {t(`regStage${stage === 'scan-center' ? 'Center' : stage === 'scan-left' ? 'Left' : stage === 'scan-right' ? 'Right' : 'Smile'}Desc`)}
            </Text>
          </View>

          <Animated.View style={[styles.cameraArea, animatedCameraFrameStyle]}>
            <View style={styles.cameraFrameWrapper}>
              <CameraView active={true} onFrame={handleFrame} />
              <FaceOvalGuide
                detected={faceDetected}
                width={faceBox ? faceBox.width : 220}
                height={faceBox ? faceBox.height : 300}
                x={faceBox ? faceBox.x : undefined}
                y={faceBox ? faceBox.y : undefined}
              />
              <LandmarkDots visible={showLandmarks} width={260} height={340} points={realPoints} />
              
              {/* Dynamic Futuristic HUD Guidance overlays */}
              {stage === 'scan-left' && <HudArrowLeft />}
              {stage === 'scan-right' && <HudArrowRight />}
              {stage === 'scan-center' && <HudTargetLock />}
              {stage === 'scan-smile' && <HudSmileArc active={smileActive} />}
            </View>
          </Animated.View>

          {/* Prompt card */}
          <View style={styles.promptCard}>
            <MaterialCommunityIcons name="shield-alert-outline" size={20} color={Colors.accent} />
            <Text style={styles.promptText}>{qualityPrompt}</Text>
          </View>

          <LightingIndicator score={lightingScore} issue={lightingIssue} />

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <Text style={styles.progressLabel}>{t('regTitle')}</Text>
          </View>
        </View>
      )}

      {/* 3. SUCCESS CARD */}
      {stage === 'success' && !showLanguageSelect && (
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
            {enrollName} {t('regSuccessDesc')}
          </Animated.Text>
          <Animated.View entering={FadeInUp.delay(700).duration(600)} style={styles.successButton}>
            <AnimatedButton label={t('save')} onPress={handleDone} variant="success" icon="check-circle" />
          </Animated.View>
        </View>
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
  cameraFlowContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  stageIndicatorWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stageTitle: {
    ...Typography.heading,
    fontSize: FontSizes.md,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  stageInstruction: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cameraArea: {
    width: 260,
    height: 340,
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
  },
  cameraFrameWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  promptText: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    gap: 8,
    paddingBottom: 24,
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

  // --- New Cybertech HUD overlays styles ---
  hudCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.accent,
    borderWidth: 2.5,
    zIndex: 10,
  },
  hudCornerTL: {
    top: 36,
    left: 36,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  hudCornerTR: {
    top: 36,
    right: 36,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  hudCornerBL: {
    bottom: 36,
    left: 36,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  hudCornerBR: {
    bottom: 36,
    right: 36,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  hudRadarRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    marginTop: -100,
    marginLeft: -100,
    borderRadius: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 212, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  hudRadarLineHorizontal: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
  },
  hudRadarLineVertical: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    position: 'absolute',
  },
  hudArrowWrapperLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -27,
    zIndex: 12,
  },
  hudArrowWrapperRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -27,
    zIndex: 12,
  },
  hudSmileArcContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  hudSmileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    borderWidth: 1.5,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Shadows.glow(Colors.accentDim),
  },
  hudSmileBubbleActive: {
    borderColor: '#00FF88',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    ...Shadows.glow('rgba(0, 255, 136, 0.2)'),
  },
  hudSmileText: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.accent,
    letterSpacing: 1.0,
  },
  hudSmileTextActive: {
    color: '#00FF88',
  },

  // --- Stage Checklist Progress Styles ---
  checklistContainer: {
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 20,
    position: 'relative',
  },
  checklistLineTrack: {
    position: 'absolute',
    top: 17,
    left: 44,
    right: 44,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistItem: {
    alignItems: 'center',
    width: 68,
  },
  checklistCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(10, 15, 30, 0.9)',
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  checklistCircleActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
    ...Shadows.glow(Colors.accentDim),
  },
  checklistCircleActiveInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  checklistCircleDone: {
    borderColor: '#00FF88',
    backgroundColor: '#00FF88',
  },
  checklistCircleText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    ...Typography.bodySemiBold,
  },
  checklistLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
    ...Typography.body,
    marginTop: 6,
    textAlign: 'center',
  },
  checklistLabelActive: {
    color: Colors.accent,
    ...Typography.bodySemiBold,
  },
  checklistLabelDone: {
    color: '#00FF88',
  },

  // --- Language Selection Overlay Styles ---
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
