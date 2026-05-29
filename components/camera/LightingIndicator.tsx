import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, FontSizes, BorderRadius } from '../../constants/theme';

interface LightingIndicatorProps {
  score: number;
  issue: string | null;
}

export default function LightingIndicator({ score, issue }: LightingIndicatorProps) {
  const getBarColor = (val: number) => {
    if (val >= 60) return '#00ff88'; // Vibrant green
    if (val >= 40) return '#ffaa00'; // Amber/Orange
    return '#ff3333'; // Bright red
  };

  const getIssueMessage = (iss: string | null) => {
    switch (iss) {
      case 'too_dark':
        return 'Too dark, move to better light';
      case 'too_bright':
        return 'Too bright, avoid direct sunlight';
      case 'shadow':
        return 'Shadow detected, adjust position';
      case 'backlight':
        return 'Avoid light source behind you';
      default:
        return 'Lighting Acceptable';
    }
  };

  const barColor = getBarColor(score);
  const message = getIssueMessage(issue);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>Lighting Quality</Text>
        <Text style={[styles.scoreText, { color: barColor }]}>{score}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${score}%`, backgroundColor: barColor }]} />
      </View>
      {issue && <Text style={styles.issueText}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelText: {
    ...Typography.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  scoreText: {
    ...Typography.bodySemiBold,
    fontSize: FontSizes.xs,
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  issueText: {
    ...Typography.bodyMedium,
    fontSize: FontSizes.xs,
    color: '#ffaa00',
    marginTop: 6,
    textAlign: 'center',
  },
});
