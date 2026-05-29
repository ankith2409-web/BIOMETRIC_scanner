import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import FaceOvalGuide from '../components/camera/FaceOvalGuide';
import ScanRing from '../components/camera/ScanRing';
import ConfidenceRing from '../components/camera/ConfidenceRing';
import LivenessPrompt from '../components/camera/LivenessPrompt';
import LandmarkDots from '../components/camera/LandmarkDots';
import LightingIndicator from '../components/camera/LightingIndicator';
import AnimatedButton from '../components/ui/AnimatedButton';
import CameraView from '../components/camera/CameraView';
import { Colors, Typography, FontSizes, BorderRadius, Shadows } from '../constants/theme';
import { storageService } from '../services/storageService';
import { sqliteService } from '../services/sqliteService';
import { modelLoader } from '../src/engine/modelLoader';
import { frameProcessorEngine } from '../src/engine/frameProcessor';
import { t } from '../services/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AuthState = 'loading' | 'scanning' | 'liveness' | 'processing' | 'success' | 'failure';

function ResultOverlay({
  state,
  name,
  confidence,
  authTime,
  onRetry,
  onDone,
}: {
  state: 'success' | 'failure';
  name: string;
  confidence: number;
  authTime?: string;
  onRetry: () => void;
  onDone: () => void;
}) {
  const isSuccess = state === 'success';
  const color = isSuccess ? Colors.success : Colors.danger;

  return (
    <View style={styles.resultOverlay}>
      <LinearGradient colors={[color + '08', 'transparent']} style={StyleSheet.absoluteFill} />

      {/* Result ring */}
      <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.resultRingContainer}>
        <View style={[styles.resultCircle, { borderColor: color, ...Shadows.glow(color) }]}>
          <MaterialCommunityIcons
            name={isSuccess ? 'shield-check' : 'shield-alert'}
            size={44}
            color={color}
          />
        </View>
      </Animated.View>

      {/* Result text */}
      <Animated.Text entering={FadeInUp.delay(300).duration(600)} style={[styles.resultTitle, { color }]}>
        {isSuccess ? 'Identity Confirmed' : 'Face Not Recognized'}
      </Animated.Text>

      {isSuccess && (
        <>
          <Animated.Text entering={FadeInUp.delay(400).duration(600)} style={styles.resultName}>
            {name}
          </Animated.Text>
          {authTime ? (
            <Animated.View
              entering={FadeInUp.delay(450).duration(600)}
              style={styles.successTimestampCard}
            >
              <MaterialCommunityIcons name="clock-outline" size={14} color="#00FF88" style={{ marginRight: 6 }} />
              <Text style={styles.successTimestampText}>{t('authTimeLabel') || 'Verified on'}: {authTime}</Text>
            </Animated.View>
          ) : null}
          <Animated.View entering={FadeIn.delay(500).duration(800)} style={styles.confidenceContainer}>
            <ConfidenceRing percentage={confidence} size={100} strokeWidth={5} />
            <Text style={styles.confidenceLabel}>Match Confidence</Text>
          </Animated.View>
        </>
      )}

      {!isSuccess && (
        <Animated.Text entering={FadeInUp.delay(400).duration(600)} style={styles.resultSubtitle}>
          Face not identified or registered. Ensure shadows are minimal and lighting is clear.
        </Animated.Text>
      )}

      {/* Actions */}
      <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.resultActions}>
        {isSuccess ? (
          <AnimatedButton label="Done" onPress={onDone} variant="success" icon="check-circle" />
        ) : (
          <>
            <AnimatedButton label="Try Again" onPress={onRetry} variant="primary" icon="refresh" />
            <AnimatedButton
              label="Register Face"
              onPress={onDone}
              variant="ghost"
              icon="account-plus"
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </Animated.View>
    </View>
  );
}

export default function AuthenticateScreen() {
  const router = useRouter();

  // Authentication states
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [showResult, setShowResult] = useState<'success' | 'failure' | null>(null);
  const [matchedName, setMatchedName] = useState('');
  const [matchedConfidence, setMatchedConfidence] = useState(0);
  const [authTime, setAuthTime] = useState('');

  // Camera & overlay states
  const [faceDetected, setFaceDetected] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [realPoints, setRealPoints] = useState<{ x: number; y: number }[] | undefined>(undefined);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [qualityPrompt, setQualityPrompt] = useState<string>('Detecting face...');
  const [debugText, setDebugText] = useState<string>('Console initialized. Awaiting face...');
  const [lightingScore, setLightingScore] = useState(100);
  const [lightingIssue, setLightingIssue] = useState<string | null>(null);

  const scanPulse = useSharedValue(1);

  // References
  const isProcessing = useRef(false);
  const stableCount = useRef(0);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchAttempts = useRef(0);

  // Load models on mount
  useEffect(() => {
    frameProcessorEngine.resetLiveness();
    modelLoader
      .loadAll()
      .then(() => {
        setAuthState('scanning');
        setDebugText('Mock models initialized. Scanning started.');
      })
      .catch(err => {
        console.error('Auth model loading failed:', err);
        setAuthState('failure');
        setShowResult('failure');
        setDebugText(`Model loading error: ${err.message}`);
      });
  }, []);

  // Animate pulse during processing
  useEffect(() => {
    if (authState === 'processing') {
      scanPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      scanPulse.value = 1;
    }
  }, [authState]);

  // Set timeout safety: if stuck for 12 seconds, fail
  useEffect(() => {
    if (authState === 'scanning' || authState === 'liveness') {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      timeoutId.current = setTimeout(() => {
        if (authState === 'scanning' || authState === 'liveness') {
          storageService.addLog({
            name: 'Timeout / Unrecognized',
            timestamp: 'Just now',
            status: 'failure',
            confidence: 0,
          });
          setAuthState('failure');
          setShowResult('failure');
        }
      }, 15000);
    }

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [authState]);

  // Frame processing loop
  const handleFrame = useCallback(async (frame: Uint8Array) => {
    if (isProcessing.current || authState === 'success' || authState === 'failure' || authState === 'loading') return;
    isProcessing.current = true;

    try {
      // The gallery is now loaded internally by the engine from storageService
      // so we no longer need to pass it here.
      const { auth, process } = await frameProcessorEngine.processForAuth(frame, undefined, (msg) => {
        setDebugText(msg);
      });
      console.log('[FaceGate][Auth] timing(ms)', process.timing);

      if (!process.faceFound) {
        setFaceDetected(false);
        setShowLandmarks(false);
        setRealPoints(undefined);
        setFaceBox(null);
        setQualityPrompt('Detecting face...');
        stableCount.current = 0;
        return;
      }

      setFaceDetected(true);
      setShowLandmarks(true);
      setRealPoints(process.landmarks?.map(p => ({ x: p.x * 200, y: p.y * 260 })) ?? []);
      if (process.detection) {
        const boxWidth = process.detection.width * 200;
        const boxX = process.detection.x * 200;
        setFaceBox({
          x: 200 - boxX - boxWidth, // Mirror X coordinate for mirrored preview
          y: process.detection.y * 260,
          width: boxWidth,
          height: process.detection.height * 260,
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
        matchAttempts.current = 0;
        return;
      }

      // If authState is already 'processing', they have already passed liveness for this session.
      const hasPassedLiveness = process.livenessPass || authState === 'processing';

      if (process.qualityPass === false) {
        setQualityPrompt(process.qualityMessage ?? 'Adjust your position and lighting.');
        return;
      } else if (!hasPassedLiveness) {
        setQualityPrompt('Blink, smile, or turn head to verify presence');
        if (authState === 'scanning') setAuthState('liveness');
        return;
      } else {
        setQualityPrompt('');
      }

      if (authState === 'scanning' || authState === 'liveness') {
        setAuthState('processing');
      }

      // Attempt matching only after liveness is passed
      if (authState === 'processing' && process.faceFound && process.embedding) {
        const confidencePct = Math.round((auth.confidence ?? 0) * 100);
        if (auth.matched && confidencePct >= 95) {
          setMatchedName(auth.name ?? 'Known User');
          setMatchedConfidence(confidencePct);
          
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

          storageService.addLog({
            name: auth.name ?? 'Known User',
            timestamp: 'Just now',
            status: 'success',
            confidence: confidencePct,
          });
          storageService.addAuthLog({
            userId: auth.userId,
            name: auth.name ?? 'Known User',
            matched: true,
            confidence: auth.confidence,
            livenessPass: true,
            timestamp: new Date().toISOString(),
          });
          sqliteService.addAuthLog({
            userId: auth.userId,
            name: auth.name ?? 'Known User',
            matched: true,
            confidence: auth.confidence,
            livenessPass: true,
            timestamp: new Date().toISOString(),
          });
          setAuthState('success');
          setShowResult('success');
          matchAttempts.current = 0;
        } else {
          matchAttempts.current += 1;
          // Give 8 frames of attempts across different head angles before failing
          if (matchAttempts.current >= 8) {
            storageService.addLog({
              name: 'Unknown User',
              timestamp: 'Just now',
              status: 'failure',
              confidence: Math.round((auth.confidence ?? 0.3) * 100),
            });
            storageService.addAuthLog({
              name: 'Unknown User',
              matched: false,
              confidence: auth.confidence,
              livenessPass: true,
              timestamp: new Date().toISOString(),
            });
            sqliteService.addAuthLog({
              name: 'Unknown User',
              matched: false,
              confidence: auth.confidence,
              livenessPass: true,
              timestamp: new Date().toISOString(),
            });
            setAuthState('failure');
            setShowResult('failure');
            matchAttempts.current = 0;
          }
        }
      }
    } catch (e) {
      console.warn('Auth processing loop error:', e);
    } finally {
      isProcessing.current = false;
    }
  }, [authState]);

  const handleRetry = () => {
    setShowResult(null);
    setMatchedName('');
    setMatchedConfidence(0);
    setAuthTime('');
    setFaceDetected(false);
    setShowLandmarks(false);
    setRealPoints(undefined);
    setQualityPrompt('Detecting face...');
    stableCount.current = 0;
    matchAttempts.current = 0;
    frameProcessorEngine.resetLiveness();
    setAuthState('scanning');
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanPulse.value }],
  }));

  const isCamera = !showResult && authState !== 'loading';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0A0F1E', '#111B33', '#0A1020']} style={StyleSheet.absoluteFill} />

      {/* Grid Overlay */}
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
        <Text style={styles.topTitle}>Authenticate Identity</Text>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  authState === 'success'
                    ? Colors.success
                    : authState === 'failure'
                    ? Colors.danger
                    : Colors.accent,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {authState === 'loading'
              ? 'Loading AI'
              : authState === 'scanning'
              ? 'Scanning'
              : authState === 'liveness'
              ? 'Liveness'
              : authState === 'processing'
              ? 'Analyzing'
              : authState === 'success'
              ? 'Verified'
              : 'Failed'}
          </Text>
        </View>
      </View>

      {/* Model loading screen */}
      {authState === 'loading' && (
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="brain" size={64} color={Colors.accent} style={styles.loadingBrain} />
          <Text style={styles.loadingText}>Initializing neural networks...</Text>
        </View>
      )}

      {/* Camera View Area */}
      {isCamera && (
        <View style={styles.cameraArea}>
          <Animated.View style={authState === 'processing' ? pulseStyle : undefined}>
            <ScanRing
              size={290}
              processing={authState === 'processing' || authState === 'scanning'}
              success={authState === 'success'}
              failure={authState === 'failure'}
            />
            <View style={styles.ovalInsideRing}>
              {/* Rounded viewport for camera */}
              <View style={styles.cameraContainer}>
                <CameraView active={isCamera} onFrame={handleFrame} />
              </View>
              {/* Guides & landmarks overlay */}
              <FaceOvalGuide
                detected={faceDetected}
                width={faceBox ? faceBox.width : 200}
                height={faceBox ? faceBox.height : 260}
                x={faceBox ? faceBox.x : undefined}
                y={faceBox ? faceBox.y : undefined}
              />
              <LandmarkDots
                visible={showLandmarks}
                width={200}
                height={260}
                points={realPoints}
              />
            </View>
          </Animated.View>
        </View>
      )}

      {/* Liveness prompt */}
      {isCamera && (authState === 'liveness' || qualityPrompt) && (
        <LivenessPrompt
          prompt={qualityPrompt || 'Blink, smile, or turn head to verify presence'}
          icon={qualityPrompt ? 'weather-sunny-alert' : 'face-recognition'}
        />
      )}

      {/* Processing indicator */}
      {isCamera && authState === 'processing' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.processingCard}>
          <View style={styles.processingDots}>
            {[0, 1, 2].map(i => (
              <ProcessingDot key={i} delay={i * 200} />
            ))}
          </View>
          <Text style={styles.processingText}>Cross-matching biometrics (Database &gt;95%)</Text>
        </Animated.View>
      )}

      {isCamera && (
        <View style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
          <LightingIndicator score={lightingScore} issue={lightingIssue} />
        </View>
      )}

      {/* Result card overlay */}
      {showResult && (
        <ResultOverlay
          state={showResult}
          name={matchedName}
          confidence={matchedConfidence}
          authTime={authTime}
          onRetry={handleRetry}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}

function ProcessingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingBrain: {
    opacity: 0.6,
  },
  loadingText: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  cameraArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovalInsideRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    width: 200,
    height: 260,
    borderRadius: 100,
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  processingCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  processingDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  processingText: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  // Result overlay
  resultOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  resultRingContainer: {
    marginBottom: 24,
  },
  resultCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    ...Typography.heading,
    fontSize: FontSizes['2xl'],
    marginBottom: 8,
  },
  resultName: {
    ...Typography.headingMedium,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  resultSubtitle: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  confidenceContainer: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  confidenceLabel: {
    ...Typography.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  resultActions: {
    width: '100%',
    marginTop: 12,
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
    marginBottom: 20,
    ...Shadows.glow('rgba(0, 255, 136, 0.05)'),
  },
  successTimestampText: {
    color: '#00FF88',
    fontFamily: 'monospace',
    fontSize: FontSizes.xs,
    letterSpacing: 0.5,
  },
});
