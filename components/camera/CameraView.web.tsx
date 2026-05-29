import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Manage WebRTC Camera Stream on Web
  useEffect(() => {
    if (!active) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      .then(s => {
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(err => {
        console.error('Camera Access Error:', err);
        setError('Camera access denied or unavailable.');
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [active]);

  // Frame Capture Loop
  useEffect(() => {
    if (!active || !stream || !onFrame) return;

    const canvas = document.createElement('canvas');
    // 160×160 is the sweet-spot for TinyFaceDetector: valid inputSize,
    // fast enough for <1s processing, high enough for face-recognition-net.
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let animFrameId: number;
    let lastTime = 0;
    let processing = false;
    
    const processFrame = (time: number) => {
      // Throttle to ~4fps — matches face-api.js actual processing throughput
      if (time - lastTime >= 250 && !processing) {
        if (videoRef.current && videoRef.current.readyState >= 2 && ctx) {
          processing = true;
          ctx.drawImage(videoRef.current, 0, 0, 160, 160);
          const imageData = ctx.getImageData(0, 0, 160, 160);
          const rgb = new Uint8Array(160 * 160 * 3);
          for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 3) {
            rgb[j] = imageData.data[i];
            rgb[j + 1] = imageData.data[i + 1];
            rgb[j + 2] = imageData.data[i + 2];
          }
          // Release processing flag asynchronously after the consumer finishes
          Promise.resolve(onFrame(rgb)).finally(() => { processing = false; });
          lastTime = time;
        }
      }
      animFrameId = requestAnimationFrame(processFrame);
    };

    animFrameId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [active, stream, onFrame]);

  return (
    <View style={[styles.container, style]}>
      <style dangerouslySetInnerHTML={{ __html: `
        .camera-video-element {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          transform: scaleX(-1) !important;
        }
      `}} />
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          translate="no"
          onContextMenu={(e) => e.preventDefault()}
          className="camera-video-element"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
    borderRadius: 24,
    position: 'relative',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});
