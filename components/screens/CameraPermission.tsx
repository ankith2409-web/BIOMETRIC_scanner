import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedButton from '../ui/AnimatedButton';
import { Colors, Typography, FontSizes, Shadows } from '../../constants/theme';

interface CameraPermissionProps {
  onOpenSettings: () => void;
}

export default function CameraPermission({ onOpenSettings }: CameraPermissionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="camera-off" size={56} color={Colors.danger} />
      </View>
      <Text style={styles.title}>Camera Access Required</Text>
      <Text style={styles.subtitle}>
        FaceGate needs camera access to detect and recognize faces. Please enable camera permissions in your device settings.
      </Text>
      <AnimatedButton
        label="Open Settings"
        onPress={onOpenSettings}
        icon="cog"
        variant="primary"
        style={{ marginTop: 24, width: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.borderDanger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Shadows.glow(Colors.danger),
  },
  title: {
    ...Typography.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
