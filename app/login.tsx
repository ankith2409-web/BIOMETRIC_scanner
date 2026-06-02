import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn
} from 'react-native-reanimated';
import CameraView from '../components/camera/CameraView';
import FaceOvalGuide from '../components/camera/FaceOvalGuide';
import LandmarkDots from '../components/camera/LandmarkDots';
import AnimatedButton from '../components/ui/AnimatedButton';
import ArchitectureIcon from '../components/ui/ArchitectureIcons';
import GlassCard from '../components/ui/GlassCard';
import IndianFlag from '../components/ui/IndianFlag';
import Toast from '../components/ui/Toast';
import LivenessPrompt from '../components/camera/LivenessPrompt';
import LightingIndicator from '../components/camera/LightingIndicator';
import { BorderRadius, Colors, FontSizes, Shadows, Typography } from '../constants/theme';
import { getLocale, setLocale, t } from '../services/i18n';
import { storageService } from '../services/storageService';
import { frameProcessorEngine } from '../src/engine/frameProcessor';
import { matchEmbedding } from '../src/engine/matcher';
import { modelLoader } from '../src/engine/modelLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ScreenMode = 'language-select' | 'phone-input' | 'face-auth' | 'success' | 'not-found' | 'admin-password';

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
          withTiming(-40, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) })
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

function RippleRing({ delay }: { delay: number }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(2.2, { duration: 2000, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.rippleRing, ringStyle]} />;
}

function ScanningBeam() {
  const translateY = useSharedValue(10);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(340, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(10, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.scanBeam, beamStyle]}>
      <LinearGradient
        colors={['transparent', 'rgba(0, 212, 255, 0.4)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function AnimatedFormIcon({ children, style }: { children: React.ReactNode; style?: any }) {
  const pulse = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      { rotate: `${rotation.value}deg` }
    ],
  }));

  return (
    <Animated.View style={[styles.formIcon, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

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
export default function LoginScreen() {
  const router = useRouter();

  const handleAdminBypass = () => {
    setMode('admin-password');
  };

  const verifyAdminPassword = () => {
    if (adminPassword === '00000') {
      const adminUser = {
        id: 'admin',
        name: 'Administrator',
        phone: adminPhone || '+919999999999',
        registeredAt: new Date().toISOString().split('T')[0],
        status: 'active' as const,
      };
      storageService.setLoggedInUser(adminUser);
      router.replace('/(tabs)');
    } else {
      setToast({ message: 'Incorrect Admin Password', type: 'error' });
      setAdminPassword('');
    }
  };

  // Screen modes & inputs
  const [mode, setMode] = useState<ScreenMode>('language-select');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(getLocale());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(t('initModels'));
  const [authTime, setAuthTime] = useState('');

  useEffect(() => {
    setLoadingStatus(t('initModels'));
  }, [selectedLanguage]);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Biometrics & camera states
  const [faceDetected, setFaceDetected] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [realPoints, setRealPoints] = useState<{ x: number; y: number }[] | undefined>(undefined);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [qualityPrompt, setQualityPrompt] = useState<string>('Detecting face...');
  const [debugText, setDebugText] = useState<string>('Ready for mobile input.');
  const [lightingScore, setLightingScore] = useState(100);
  const [lightingIssue, setLightingIssue] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<{
    recogConfidence: number;
    livenessConfidence: number;
    qualityConfidence: number;
    temporalConfidence: number;
    gapConfidence: number;
    finalConfidence: number;
    bestDist: number;
    runnerUpDist: number;
    gap: number;
    isSpoof: boolean;
    historySize: number;
  } | null>(null);

  // References
  const isProcessing = useRef(false);
  const authAttempts = useRef(0);
  const maxAuthAttempts = 45;
  const livenessPassedRef = useRef(false);

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
        setDebugText('AI models successfully loaded.');
      })
      .catch(err => {
        console.error('Model loading failed:', err);
        setLoadingStatus('AI model initialization failed.');
        setDebugText(`Model loading failed: ${err.message}`);
      });
  }, []);

  // Handle phone verification
  const handleVerifyPhone = () => {
    // Validate: 10 numeric digits
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setDebugText('Invalid phone number. Must be exactly 10 digits.');
      return;
    }

    const fullPhone = `+91${cleaned}`;
    setDebugText(`Searching for ${fullPhone} in database...`);

    const user = storageService.getUserByPhone(fullPhone);
    if (user) {
      setMatchedUser(user);
      setMode('face-auth');
      setDebugText(`Registered user found: ${user.name}. Starting face check...`);
      authAttempts.current = 0;
    } else {
      setDebugText(`Phone number ${fullPhone} is not registered. Redirecting to registration...`);
      // Go directly to registration â€” no intermediate "not found" screen
      router.replace({
        pathname: '/register-portal',
        params: { phone: fullPhone, name: userName },
      });
    }
  };

  // Face checking frame loop
  const handleFrame = useCallback(async (frame: Uint8Array) => {
    if (isProcessing.current || mode !== 'face-auth' || !matchedUser) return;
    isProcessing.current = true;

    try {
      const threshold = storageService.getSettings().threshold;
      const userGallery = storageService
        .getFaceEmbeddingsAsGallery()
        .filter(e => e.userId === matchedUser.id);

      if (!userGallery.length) {
        setDebugText('Biometric templates missing from database. Re-register.');
        setMode('not-found');
        return;
      }

      const { auth, process } = await frameProcessorEngine.processForAuth(frame, userGallery, (msg) => {
        setDebugText(msg);
      });

      if (!process.faceFound) {
        setFaceDetected(false);
        setShowLandmarks(false);
        setRealPoints(undefined);
        setFaceBox(null);
        setQualityPrompt('No face detected. Move closer to the camera.');
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
          if (issue === 'too_dark') return "Too dark. Improve lighting conditions.";
          if (issue === 'too_bright') return "Too bright. Improve lighting conditions.";
          if (issue === 'shadow') return "Shadow detected. Improve lighting conditions.";
          if (issue === 'backlight') return "Avoid backlight. Improve lighting conditions.";
          return "Poor lighting. Improve lighting conditions.";
        };
        setQualityPrompt(getLightingMessage(process.lightingIssue ?? null));
        return;
      }

      if (process.qualityPass === false) {
        let msg = process.qualityMessage ?? 'Adjust your position and lighting.';
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('closer') || lowerMsg.includes('fill')) {
          msg = 'Move closer to the camera.';
        } else if (lowerMsg.includes('center') || lowerMsg.includes('oval') || lowerMsg.includes('position')) {
          msg = 'Align your face inside the guide area.';
        } else if (lowerMsg.includes('straight') || lowerMsg.includes('angle') || lowerMsg.includes('tilt')) {
          msg = 'Face the camera more directly.';
        }
        setQualityPrompt(msg);
        return;
      }

      setQualityPrompt('Verifying presence...');

      // Telemetry update
      if (auth) {
        setTelemetry({
          recogConfidence: auth.recogConfidence ?? 0,
          livenessConfidence: auth.livenessConfidence ?? 0,
          qualityConfidence: auth.qualityConfidence ?? 0,
          temporalConfidence: auth.temporalConfidence ?? 0,
          gapConfidence: auth.gapConfidence ?? 0,
          finalConfidence: auth.confidence ?? 0,
          bestDist: auth.bestDist ?? 0,
          runnerUpDist: auth.runnerUpDist ?? 0,
          gap: auth.gap ?? 0,
          isSpoof: !!auth.isSpoof,
          historySize: auth.historySize ?? 0,
        });

        // Detailed telemetry console logging
        console.log(`[FaceGate][Login][Telemetry] Attempt ${authAttempts.current + 1}/${maxAuthAttempts}
          - Recognition Distance (bestDist): ${auth.bestDist?.toFixed(4)} (Threshold: ${threshold})
          - Runner-up Distance: ${auth.runnerUpDist?.toFixed(4)}
          - Confidence Gap: ${auth.gap?.toFixed(4)} (Margin: 0.08, Pass: ${auth.gapPass})
          - Liveness Confidence: ${auth.livenessConfidence?.toFixed(4)} (Threshold: 0.65, Pass: ${auth.livenessPass})
          - Image Quality Confidence: ${auth.qualityConfidence?.toFixed(4)} (Pass: ${process.qualityPass})
          - Temporal Confidence: ${auth.temporalConfidence?.toFixed(4)} (Size: ${auth.historySize}/3)
          - Frame Processing Time: ${process.timing?.total ?? 'N/A'}ms
          - Rejection Reason: ${auth.isSpoof ? 'Photo Spoof detected' : (!auth.livenessPass ? 'Liveness failed (hold still)' : (auth.bestDist > threshold ? 'Face mismatch' : 'Gap/Temporal check failed'))}
        `);
      }

      if (auth.matched) {
        // Log in successful!
        const confidencePct = Math.round((auth.confidence ?? 0.95) * 100);
        setDebugText(`Biometric match verified! Confidence: ${confidencePct}%`);

        storageService.addLog({
          name: matchedUser.name,
          timestamp: 'Just now',
          status: 'success',
          confidence: confidencePct,
        });

        storageService.addAuthLog({
          userId: matchedUser.id,
          name: matchedUser.name,
          matched: true,
          confidence: auth.confidence,
          livenessPass: true,
          timestamp: new Date().toISOString(),
        });

        // Set logged in user state
        storageService.setLoggedInUser(matchedUser);

        // Record exact authentication timestamp
        const now = new Date();
        const formattedDate = now.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const formattedTime = now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setAuthTime(`${formattedDate}, ${formattedTime}`);

        setMode('success');
      } else {
        authAttempts.current += 1;
        setDebugText(`Biometric mismatch (Attempt ${authAttempts.current}/${maxAuthAttempts})`);

        if (authAttempts.current >= maxAuthAttempts) {
          storageService.addLog({
            name: matchedUser.name,
            timestamp: 'Just now',
            status: 'failure',
            confidence: Math.round((auth.confidence ?? 0.35) * 100),
          });
          
          let failReason = 'Biometric validation limit exceeded. Access denied.';
          if (auth.isSpoof) {
            failReason = 'Anti-spoofing verification failed. Photo/replay detected.';
          } else if (!auth.livenessPass) {
            failReason = 'Liveness check failed. Hold still and look naturally at the camera.';
          } else if (auth.bestDist > threshold) {
            failReason = 'Identity could not be verified. Ensure your face is registered.';
          }
          setDebugText(failReason);
          setToast({ message: failReason, type: 'error' });
          setMode('phone-input');
          setMatchedUser(null);
        }
      }
    } catch (e: any) {
      console.warn('Login frame verification error:', e);
      setDebugText(`Verification error: ${e.message}`);
    } finally {
      isProcessing.current = false;
    }
  }, [mode, matchedUser]);

  const handleStartRegister = () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    router.replace({
      pathname: '/register-portal',
      params: { phone: `+91${cleaned}` },
    });
  };

  const handleDone = () => {
    router.replace('/(tabs)');
  };

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

      {/* Floating Background Particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingParticle delay={0} x={40} y={150} size={3} />
        <FloatingParticle delay={1000} x={120} y={280} size={4} />
        <FloatingParticle delay={500} x={280} y={120} size={3} />
        <FloatingParticle delay={1500} x={80} y={450} size={5} />
        <FloatingParticle delay={2000} x={320} y={350} size={3} />
        <FloatingParticle delay={800} x={150} y={600} size={4} />
        <FloatingParticle delay={1200} x={50} y={750} size={3} />
        <FloatingParticle delay={1800} x={250} y={500} size={4} />
        <FloatingParticle delay={300} x={300} y={700} size={5} />
        <FloatingParticle delay={2200} x={180} y={200} size={3} />
      </View>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Admin Bypass Button in Top-Right Corner */}
      {(mode === 'phone-input' || mode === 'language-select') && (
        <Pressable
          style={styles.adminButton}
          onPress={handleAdminBypass}
        >
          <MaterialCommunityIcons name="security" size={14} color="#FFD400" />
          <Text style={styles.adminButtonText}>Admin</Text>
        </Pressable>
      )}

      {/* ADMIN PASSWORD MODE */}
      {mode === 'admin-password' && (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.inputForm}>
          <GlassCard padding={24}>
            <AnimatedFormIcon>
              <MaterialCommunityIcons name="lock-outline" size={44} color={Colors.accent} />
            </AnimatedFormIcon>
            <Text style={styles.formTitle}>Admin Access</Text>
            <Text style={styles.formSubtitle}>
              Please enter your credentials to continue.
            </Text>

            <View style={{ gap: 12 }}>
              <View style={styles.phoneInputWrapper}>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Admin Mobile Number"
                  placeholderTextColor={Colors.textTertiary}
                  value={adminPhone}
                  onChangeText={setAdminPhone}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.phoneInputWrapper}>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter Password"
                  placeholderTextColor={Colors.textTertiary}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <AnimatedButton
                label="Cancel"
                onPress={() => {
                  setMode('phone-input');
                  setAdminPassword('');
                  setAdminPhone('');
                }}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <AnimatedButton
                label="Verify"
                onPress={verifyAdminPassword}
                variant="primary"
                icon="lock-check"
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </Animated.View>
      )}

      {/* 0. LANGUAGE SELECTION MODE */}

      {mode === 'language-select' && (
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
                  const isSelected = selectedLanguage === lang.id;
                  return (
                    <Pressable
                      key={lang.id}
                      onPress={() => {
                        setSelectedLanguage(lang.id);
                        setLocale(lang.id);
                        setTimeout(() => {
                          setMode('phone-input');
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
          </GlassCard>
        </Animated.View>
      )}

      {/* 1. PHONE INPUT MODE */}
      {mode === 'phone-input' && (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.inputForm}>
          <GlassCard padding={24}>
            {/* Globe Language Switcher */}
            <Pressable
              style={styles.globeButton}
              onPress={() => setMode('language-select')}
            >
              <MaterialCommunityIcons name="translate" size={14} color={Colors.accent} />
              <Text style={styles.globeButtonText}>{selectedLanguage.toUpperCase()}</Text>
            </Pressable>

            <AnimatedFormIcon>
              <MaterialCommunityIcons name="cellphone-key" size={44} color={Colors.accent} />
            </AnimatedFormIcon>
            <Text style={styles.formTitle}>{t('secureLogin')}</Text>
            <Text style={styles.formSubtitle}>
              {t('phoneSubtitle')}
            </Text>

            <View style={{ gap: 12 }}>
              <View style={styles.phoneInputWrapper}>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textTertiary}
                  value={userName}
                  onChangeText={setUserName}
                />
              </View>

              <View style={styles.phoneInputWrapper}>
                <View style={styles.phonePrefix}>
                  <IndianFlag width={22} height={14} style={{ marginRight: 6 }} />
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="98765 43210"
                  placeholderTextColor={Colors.textTertiary}
                  value={phoneNumber}
                  onChangeText={(val) => setPhoneNumber(val.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>

            <AnimatedButton
              label={modelsLoaded ? t('verifyIdentity') : t('loadingModels')}
              onPress={handleVerifyPhone}
              disabled={!modelsLoaded || phoneNumber.replace(/\D/g, '').length !== 10 || userName.trim().length === 0}
              variant="primary"
              icon="fingerprint"
              style={{ marginTop: 24 }}
            />
          </GlassCard>
        </Animated.View>
      )}

      {/* 2. FACE AUTHENTICATION MODE */}
      {mode === 'face-auth' && matchedUser && (
        <View style={styles.faceAuthContainer}>
          <Text style={styles.scanTitle}>{t('verifyingUser')}</Text>
          <Text style={styles.scanSubtitle}>{t('hello')}, {matchedUser.name}. {t('scanSubtitle')}</Text>

          <View style={styles.cameraArea}>
            <View style={styles.cameraFrameWrapper}>
              <CameraView active={mode === 'face-auth'} onFrame={handleFrame} />
              <ScanningBeam />
              <FaceOvalGuide
                detected={faceDetected}
                width={faceBox ? faceBox.width : 220}
                height={faceBox ? faceBox.height : 300}
                x={faceBox ? faceBox.x : undefined}
                y={faceBox ? faceBox.y : undefined}
              />
              <LandmarkDots visible={showLandmarks} width={280} height={370} points={realPoints} />
            </View>
          </View>

          {/* Liveness prompt */}
          {qualityPrompt && (
            <LivenessPrompt
              prompt={qualityPrompt}
              icon="face-recognition"
            />
          )}

          {/* Lighting Indicator & Telemetry */}
          <View style={{ width: 280, marginTop: 12, marginBottom: 12, gap: 8 }}>
            <LightingIndicator score={lightingScore} issue={lightingIssue} />
            {telemetry && (
              <View style={styles.telemetryCard}>
                <Text style={styles.telemetryTitle}>🛡️ Live Security Telemetry (Admin)</Text>
                <View style={styles.telemetryGrid}>
                  <View style={styles.telemetryRow}>
                    <Text style={styles.telemetryLabel}>Recognition</Text>
                    <Text style={styles.telemetryValue}>{(telemetry.recogConfidence * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={styles.telemetryRow}>
                    <Text style={styles.telemetryLabel}>Liveness</Text>
                    <Text style={[styles.telemetryValue, telemetry.isSpoof ? {color: Colors.danger} : {color: Colors.success}]}>
                      {(telemetry.livenessConfidence * 100).toFixed(1)}% {telemetry.isSpoof ? '(SPOOF)' : '(PASS)'}
                    </Text>
                  </View>
                  <View style={styles.telemetryRow}>
                    <Text style={styles.telemetryLabel}>Image Quality</Text>
                    <Text style={styles.telemetryValue}>{(telemetry.qualityConfidence * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={styles.telemetryRow}>
                    <Text style={styles.telemetryLabel}>Temporal</Text>
                    <Text style={styles.telemetryValue}>
                      {(telemetry.temporalConfidence * 100).toFixed(1)}% ({telemetry.historySize}/3)
                    </Text>
                  </View>
                  <View style={styles.telemetryRow}>
                    <Text style={styles.telemetryLabel}>Confidence Gap</Text>
                    <Text style={styles.telemetryValue}>{(telemetry.gapConfidence * 100).toFixed(1)}%</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.telemetryRowTotal}>
                  <Text style={styles.telemetryLabelTotal}>Aggregated Confidence</Text>
                  <Text style={[styles.telemetryValueTotal, telemetry.finalConfidence >= 0.95 ? {color: Colors.success} : {color: Colors.accent}]}>
                    {(telemetry.finalConfidence * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}
          </View>

          <Pressable
            style={styles.cancelButton}
            onPress={() => {
              setMode('phone-input');
              setMatchedUser(null);
              livenessPassedRef.current = false;
              setTelemetry(null);
              frameProcessorEngine.resetLiveness();
            }}
          >
            <Text style={styles.cancelButtonText}>{t('cancelScan')}</Text>
          </Pressable>
        </View>
      )}

      {/* 3. USER NOT FOUND MODE */}
      {mode === 'not-found' && (
        <Animated.View entering={ZoomIn.duration(500)} style={styles.inputForm}>
          <GlassCard padding={24}>
            <AnimatedFormIcon style={{ borderColor: Colors.warning, backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <MaterialCommunityIcons name="account-alert" size={44} color={Colors.warning} />
            </AnimatedFormIcon>
            <Text style={styles.formTitle}>{t('profileNotFound')}</Text>
            <Text style={styles.formSubtitle}>
              {t('mobileNumber')} +91 {phoneNumber} {t('notRegistered')}
            </Text>

            <AnimatedButton
              label={t('registerBiometrics')}
              onPress={handleStartRegister}
              variant="primary"
              icon="account-plus"
              style={{ marginTop: 16 }}
            />
            <AnimatedButton
              label={t('back')}
              onPress={() => setMode('phone-input')}
              variant="ghost"
              icon="arrow-left"
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        </Animated.View>
      )}

      {/* 4. SUCCESS OVERLAY */}
      {mode === 'success' && matchedUser && (
        <View style={styles.successOverlay}>
          <LinearGradient
            colors={['rgba(0, 255, 136, 0.05)', 'rgba(0, 255, 136, 0.02)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ justifyContent: 'center', alignItems: 'center', height: 160, width: SCREEN_WIDTH, marginBottom: 12, position: 'relative' }}>
            <RippleRing delay={0} />
            <RippleRing delay={1000} />
            <Animated.View entering={ZoomIn.duration(500).springify()} style={[styles.successCircle, { marginBottom: 0 }]}>
              <MaterialCommunityIcons name="shield-check" size={48} color={Colors.background} />
            </Animated.View>
          </View>
          <Animated.Text entering={FadeInUp.delay(300).duration(600)} style={styles.successTitle}>
            {t('accessGranted')}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(500).duration(600)} style={styles.successSubtitle}>
            {t('welcomeBack')}, {matchedUser.name}. {t('biometricSucceeded')}
          </Animated.Text>
          {authTime ? (
            <Animated.View
              entering={FadeInUp.delay(600).duration(600)}
              style={styles.successTimestampCard}
            >
              <MaterialCommunityIcons name="clock-outline" size={14} color="#00FF88" style={{ marginRight: 6 }} />
              <Text style={styles.successTimestampText}>{t('authTimeLabel') || 'Verified on'}: {authTime}</Text>
            </Animated.View>
          ) : null}
          <Animated.View entering={FadeInUp.delay(750).duration(600)} style={styles.successButton}>
            <AnimatedButton label={t('enterConsole')} onPress={handleDone} variant="success" icon="check-circle" />
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
  consoleContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 15, 30, 0.95)',
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: 12,
    padding: 12,
    zIndex: 9999,
  },
  consoleHeader: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  consoleText: {
    color: '#00ff88',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 14,
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
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderColor: Colors.glassBorder,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePrefixText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    ...Typography.bodySemiBold,
  },
  phoneInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Typography.body,
  },
  faceAuthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 160,
  },
  scanTitle: {
    ...Typography.heading,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  scanSubtitle: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  cameraArea: {
    width: 280,
    height: 370,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.borderAccent,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.glow(Colors.accentDim),
    marginBottom: 32,
  },
  cameraFrameWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    ...Typography.bodyMedium,
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
  successTimestampCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    borderRadius: BorderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
    ...Shadows.glow('rgba(0, 255, 136, 0.05)'),
  },
  successTimestampText: {
    color: '#00FF88',
    fontFamily: 'monospace',
    fontSize: FontSizes.xs,
    letterSpacing: 0.5,
  },
  particle: {
    position: 'absolute',
    backgroundColor: Colors.accent,
  },
  rippleRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: Colors.success,
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
    zIndex: 5,
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
  globeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    zIndex: 10,
  },
  globeButtonText: {
    ...Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.accent,
  },
  adminButton: {
    position: 'absolute',
    top: 52,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 212, 0, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 212, 0, 0.25)',
    zIndex: 100,
  },
  adminButtonText: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: '#FFD400',
  },
  telemetryCard: {
    backgroundColor: 'rgba(10, 20, 40, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    borderRadius: BorderRadius.lg,
    padding: 10,
    width: 280,
    ...Shadows.glow('rgba(0, 212, 255, 0.05)'),
  },
  telemetryTitle: {
    ...Typography.bodySemiBold,
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  telemetryGrid: {
    gap: 3,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    ...Typography.body,
    fontSize: 9,
    color: Colors.textTertiary,
  },
  telemetryValue: {
    ...Typography.bodyMedium,
    fontSize: 9,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 6,
  },
  telemetryRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabelTotal: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  telemetryValueTotal: {
    ...Typography.heading,
    fontSize: FontSizes.sm,
  },
});
