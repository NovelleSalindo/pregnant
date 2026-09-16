import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Shadows } from '../theme/colors';

interface BabySizeCardProps {
  weeks: number | null;
  days: number | null;
  trimester: number | null;
  babyFruit: string;
  babyEmoji: string;
  daysToEdd: number | null;
  edd: string | null;
}

export const BabySizeCard: React.FC<BabySizeCardProps> = ({
  weeks,
  trimester,
  babyFruit,
  babyEmoji,
  daysToEdd,
  edd,
}) => {
  return (
    <View style={[styles.card, Shadows.small]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.subtitle}>PREGNANCY MILESTONE</Text>
          <Text style={styles.title}>
            {weeks !== null ? `Week ${weeks}` : 'Getting Started'}
          </Text>
          {trimester && <Text style={styles.trimesterText}>Trimester {trimester}</Text>}
        </View>

        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{babyEmoji || '👶'}</Text>
        </View>
      </View>

      <View style={styles.comparisonBox}>
        <Text style={styles.comparisonLabel}>YOUR BABY IS ABOUT THE SIZE OF A</Text>
        <Text style={styles.fruitName}>{babyFruit || 'Little Miracle'}</Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.dueBadge}>
          <Text style={styles.dueLabel}>
            {daysToEdd !== null && daysToEdd >= 0
              ? `${daysToEdd} days until due date`
              : edd ? `Due: ${edd}` : 'Due date not set'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  trimesterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 1,
  },
  emojiContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 34,
  },
  comparisonBox: {
    backgroundColor: Colors.surfaceSoft,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fruitName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueBadge: {
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
});
