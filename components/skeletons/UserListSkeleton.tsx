import React from 'react';
import { View, StyleSheet } from 'react-native';
import ShimmerPlaceholder from '../ui/ShimmerPlaceholder';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

export default function UserListSkeleton() {
  return (
    <View style={styles.container}>
      {/* Search bar shimmer */}
      <ShimmerPlaceholder width="100%" height={48} borderRadius={12} style={{ marginBottom: 20 }} />

      {/* User card rows */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.card}>
          {/* Avatar */}
          <ShimmerPlaceholder width={48} height={48} borderRadius={24} />
          {/* Content */}
          <View style={styles.content}>
            <ShimmerPlaceholder width="55%" height={16} borderRadius={6} />
            <ShimmerPlaceholder width="35%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          {/* Status badge */}
          <ShimmerPlaceholder width={70} height={24} borderRadius={12} />
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
    paddingTop: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.glassBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 16,
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
});
