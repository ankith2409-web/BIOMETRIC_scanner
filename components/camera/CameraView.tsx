import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type Frame,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

interface CameraViewProps {
  active?: boolean;
  onFrame?: (rgb: Uint8Array) => void;
  style?: any;
}

export default function CameraView({
  active = true,
  onFrame,
  style,
}: CameraViewProps) {
  const [error, setError] = useState<string | null>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();

  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';
    if (!onFrame) return;

    const resized = resize(frame, {
      scale: { width: 128, height: 128 },
      pixelFormat: 'rgb',
      dataType: 'uint8',
    }) as Uint8Array;

    runOnJS(onFrame)(new Uint8Array(resized));
  }, [onFrame]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch(() => {
        setError('Camera permission denied.');
      });
    }
  }, [hasPermission, requestPermission]);

  if (!device) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Text style={styles.fallbackText}>No front camera found.</Text>
      </View>
    );
  }

  if (!hasPermission || error) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Text style={styles.fallbackText}>
          {error || 'Camera permission required.'}
        </Text>
      </View>
    );
  }

  return (
    <Camera
      style={[styles.container, style]}
      device={device}
      isActive={active}
      photo={false}
      video={false}
      audio={false}
      frameProcessor={frameProcessor}
      pixelFormat="yuv"
      fps={5}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
    borderRadius: 24,
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  fallbackText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
