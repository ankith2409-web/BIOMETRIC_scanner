import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedButton from '../ui/AnimatedButton';
import { Colors, Typography, FontSizes, Shadows } from '../../constants/theme';

interface ModelLoadErrorProps {
  onRetry: () => void;
}

export default function ModelLoadError({ onRetry }: ModelLoadErrorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="brain" size={56} color={Colors.warning} />
      </View>
      <Text style={styles.title}>Failed to Load AI Model</Text>
      <Text style={styles.subtitle}>
        The neural network model could not be initialized. Please restart the app and try again.
      </Text>
      <AnimatedButton
        label="Retry"
        onPress={onRetry}
        icon="refresh"
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
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
