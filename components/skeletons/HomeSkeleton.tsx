import React from 'react';
import { View, StyleSheet } from 'react-native';
import ShimmerPlaceholder from '../ui/ShimmerPlaceholder';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

export default function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header shimmer */}
      <View style={styles.header}>
        <ShimmerPlaceholder width={200} height={28} borderRadius={8} />
        <ShimmerPlaceholder width={80} height={24} borderRadius={12} />
      </View>

      {/* Action cards */}
      <View style={styles.cardRow}>
        <ShimmerPlaceholder width="48%" height={160} borderRadius={16} style={{ flex: 1 }} />
        <ShimmerPlaceholder width="48%" height={160} borderRadius={16} style={{ flex: 1 }} />
      </View>

      {/* Section title */}
      <ShimmerPlaceholder width={140} height={20} borderRadius={8} style={{ marginTop: 28 }} />

      {/* Activity feed items */}
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.feedItem}>
          <ShimmerPlaceholder width={40} height={40} borderRadius={20} />
          <View style={styles.feedContent}>
            <ShimmerPlaceholder width="60%" height={14} borderRadius={6} />
            <ShimmerPlaceholder width="40%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <ShimmerPlaceholder width={60} height={22} borderRadius={11} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  feedContent: {
    flex: 1,
  },
});
