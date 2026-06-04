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
type LivenessChallenge = 'blink' | 'smile' | 'turn_left' | 'turn_right';

const CHALLENGES: LivenessChallenge[] = ['blink', 'smile', 'turn_left', 'turn_right'];

const pickRandomChallenge = (): LivenessChallenge =>
  CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];

const challengePromptKey = (challenge: LivenessChallenge): string => {
  switch (challenge) {
    case 'blink':
      return 'authPromptBlink';
    case 'smile':
      return 'authPromptSmile';
    case 'turn_left':
      return 'authPromptTurnLeft';
    case 'turn_right':
      return 'authPromptTurnRight';
  }
};

const challengeIcon = (challenge: LivenessChallenge): string => {
  switch (challenge) {
    case 'blink':
      return 'eye-outline';
    case 'smile':
      return 'emoticon-happy-outline';
    case 'turn_left':
      return 'arrow-left-bold';
    case 'turn_right':
      return 'arrow-right-bold';
  }
};

const isChallengePassed = (
  challenge: LivenessChallenge,
  sig?: {
    blinkDetected: boolean;
    smileDetected: boolean;
    headTurnLeftDetected: boolean;
    headTurnRightDetected: boolean;
  }
): boolean => {
  if (!sig) return false;
  switch (challenge) {
    case 'blink':
      return sig.blinkDetected;
    case 'smile':
      return sig.smileDetected;
    case 'turn_left':
      return sig.headTurnLeftDetected;
    case 'turn_right':
      return sig.headTurnRightDetected;
  }
};

function ResultOverlay({
  state,
  name,
  confidence,
  authTime,
  reason,
  onRetry,
  onDone,
}: {
  state: 'success' | 'failure';
  name: string;
  confidence: number;
  authTime?: string;
  reason?: string;
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
          {reason || 'Face not identified or registered. Ensure shadows are minimal and lighting is clear.'}
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
  const [currentChallenge, setCurrentChallenge] = useState<LivenessChallenge>(() => pickRandomChallenge());
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
    duplicateFrameCount: number;
    landmarkMotionScore: number;
    embeddingVarianceScore: number;
    rejectionReason: string;
    authLatencyMs: number;
  } | null>(null);

  const scanPulse = useSharedValue(1);

  // References
  const isProcessing = useRef(false);
  const stableCount = useRef(0);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchAttempts = useRef(0);
  const challengePassedRef = useRef(false);
  const [failureReason, setFailureReason] = useState<string>('');
  const lastRejectionReason = useRef<string>('');

  // Load models on mount
  useEffect(() => {
    frameProcessorEngine.resetLiveness();
    modelLoader
      .loadAll()
      .then(() => {
        const challenge = pickRandomChallenge();
        setCurrentChallenge(challenge);
        setAuthState('scanning');
        setDebugText(`Challenge: ${challenge} — awaiting face...`);
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

  // Set timeout safety: if stuck for more than 5 seconds, fail
  useEffect(() => {
    if (authState === 'scanning' || authState === 'liveness' || authState === 'processing') {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      timeoutId.current = setTimeout(() => {
        if (authState === 'scanning' || authState === 'liveness' || authState === 'processing') {
          storageService.addLog({
            name: 'Timeout / Unrecognized',
            timestamp: 'Just now',
            status: 'failure',
            confidence: 0,
          });
          setFailureReason('Authentication timeout. Face recognition was not completed within 5 seconds.');
          setAuthState('failure');
          setShowResult('failure');
        }
      }, 5000);
    }

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [authState]);

  // Frame processing loop
  // Frame processing loop
  const handleFrame = useCallback(async (frame: Uint8Array) => {
    if (isProcessing.current || authState === 'success' || authState === 'failure' || authState === 'loading') return;
    isProcessing.current = true;

    try {
      const threshold = storageService.getSettings().threshold;
      const { auth, process } = await frameProcessorEngine.processForAuth(frame, undefined, (msg) => {
        setDebugText(msg);
      });
      console.log('[FaceGate][Auth] timing(ms)', process.timing);

      if (!process.faceFound) {
        setFaceDetected(false);
        setShowLandmarks(false);
        setRealPoints(undefined);
        setFaceBox(null);
        const msg = 'No face detected. Move closer to the camera.';
        setQualityPrompt(msg);
        lastRejectionReason.current = msg;
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
          if (issue === 'too_dark') return "Too dark. Improve lighting conditions.";
          if (issue === 'too_bright') return "Too bright. Improve lighting conditions.";
          if (issue === 'shadow') return "Shadow detected. Improve lighting conditions.";
          if (issue === 'backlight') return "Avoid backlight. Improve lighting conditions.";
          return "Poor lighting. Improve lighting conditions.";
        };
        const msg = getLightingMessage(process.lightingIssue ?? null);
        setQualityPrompt(msg);
        lastRejectionReason.current = msg;
        matchAttempts.current = 0;
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
        lastRejectionReason.current = msg;
        return;
      }

      setQualityPrompt('Verifying presence...');
      if (authState === 'scanning' || authState === 'liveness') {
        setAuthState('processing');
      }

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
          duplicateFrameCount: auth.duplicateFrameCount ?? 0,
          landmarkMotionScore: auth.landmarkMotionScore ?? 0,
          embeddingVarianceScore: auth.embeddingVarianceScore ?? 0,
          rejectionReason: auth.rejectionReason ?? '',
          authLatencyMs: auth.authLatencyMs ?? 0,
        });

        // Detailed telemetry console logging
        console.log(`[FaceGate][Auth][Telemetry] Attempt ${matchAttempts.current + 1}/45
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

      // Attempt matching using high-security validation
      if (process.faceFound && process.embedding) {
        const confidencePct = Math.round((auth.confidence ?? 0) * 100);
        if (auth.matched) {
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

          // Track detailed rejection reason for the final overlay
          let rejectionMsg = 'Identity could not be verified. Ensure your face is registered.';
          if (auth.isSpoof) {
            rejectionMsg = 'Anti-spoofing verification failed. Photo/replay detected.';
          } else if (!auth.livenessPass) {
            rejectionMsg = 'Liveness verification failed. Hold still and look naturally at the camera.';
          } else if (auth.bestDist > threshold) {
            rejectionMsg = 'Identity could not be verified. Face not recognized in local database.';
          }
          lastRejectionReason.current = rejectionMsg;

          // Give 45 frames of attempts to check before failing
          if (matchAttempts.current >= 45) {
            storageService.addLog({
              name: 'Unknown User',
              timestamp: 'Just now',
              status: 'failure',
              confidence: confidencePct,
            });
            storageService.addAuthLog({
              name: 'Unknown User',
              matched: false,
              confidence: auth.confidence,
              livenessPass: process.livenessPass ?? false,
              timestamp: new Date().toISOString(),
            });
            sqliteService.addAuthLog({
              name: 'Unknown User',
              matched: false,
              confidence: auth.confidence,
              livenessPass: process.livenessPass ?? false,
              timestamp: new Date().toISOString(),
            });
            setFailureReason(lastRejectionReason.current);
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
    const challenge = pickRandomChallenge();
    setShowResult(null);
    setMatchedName('');
    setMatchedConfidence(0);
    setAuthTime('');
    setFailureReason('');
    lastRejectionReason.current = '';
    setFaceDetected(false);
    setShowLandmarks(false);
    setRealPoints(undefined);
    setQualityPrompt('Detecting face...');
    stableCount.current = 0;
    matchAttempts.current = 0;
    challengePassedRef.current = false;
    setCurrentChallenge(challenge);
    setTelemetry(null);
    frameProcessorEngine.resetLiveness();
    setAuthState('scanning');
    setDebugText(`Awaiting face...`);
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanPulse.value }],
  }));

  const isCamera = !showResult && authState !== 'loading';
  const isPromptPhase = authState === 'scanning' || authState === 'liveness';
  const livenessUiPrompt = lightingIssue
    ? qualityPrompt
    : authState === 'liveness'
    ? t(challengePromptKey(currentChallenge))
    : qualityPrompt;
  const livenessUiIcon: keyof typeof MaterialCommunityIcons.glyphMap = lightingIssue
    ? 'weather-sunny-alert'
    : authState === 'liveness'
    ? (challengeIcon(currentChallenge) as keyof typeof MaterialCommunityIcons.glyphMap)
    : 'face-recognition';

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
      {isCamera && isPromptPhase && Boolean(livenessUiPrompt) && (
        <LivenessPrompt prompt={livenessUiPrompt} icon={livenessUiIcon} />
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
        <View style={styles.telemetryOverlayContainer}>
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
                
                {/* Advanced Admin Spoof & Latency Diagnostics */}
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Lag/Duplicate Frames</Text>
                  <Text style={styles.telemetryValue}>{telemetry.duplicateFrameCount}</Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Landmark Rigidity</Text>
                  <Text style={styles.telemetryValue}>{telemetry.landmarkMotionScore.toFixed(5)}</Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Embedding Var</Text>
                  <Text style={styles.telemetryValue}>{telemetry.embeddingVarianceScore.toFixed(5)}</Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Latency</Text>
                  <Text style={styles.telemetryValue}>{telemetry.authLatencyMs} ms</Text>
                </View>
              </View>
              
              {telemetry.rejectionReason ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.telemetryRow}>
                    <Text style={[styles.telemetryLabel, {color: Colors.danger}]}>Reason</Text>
                    <Text style={[styles.telemetryValue, {color: Colors.danger, fontSize: 10, flex: 1, textAlign: 'right'}]} numberOfLines={2}>
                      {telemetry.rejectionReason}
                    </Text>
                  </View>
                </>
              ) : null}
              
              <View style={styles.divider} />
              <View style={styles.telemetryRowTotal}>
                <Text style={styles.telemetryLabelTotal}>Aggregated Confidence</Text>
                <Text style={[styles.telemetryValueTotal, telemetry.finalConfidence >= 0.85 ? {color: Colors.success} : {color: Colors.accent}]}>
                  {(telemetry.finalConfidence * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Result card overlay */}
      {showResult && (
        <ResultOverlay
          state={showResult}
          name={matchedName}
          confidence={matchedConfidence}
          authTime={authTime}
          reason={failureReason}
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
  telemetryOverlayContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    gap: 8,
  },
  telemetryCard: {
    backgroundColor: 'rgba(10, 20, 40, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    borderRadius: BorderRadius.lg,
    padding: 12,
    ...Shadows.glow('rgba(0, 212, 255, 0.05)'),
  },
  telemetryTitle: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  telemetryGrid: {
    gap: 4,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  telemetryValue: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  telemetryRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabelTotal: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  telemetryValueTotal: {
    ...Typography.heading,
    fontSize: FontSizes.md,
  },
});
