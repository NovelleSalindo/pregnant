import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
    <View style={[styles.card, Shadows.card]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>YOUR BABY</Text>
          <Text style={styles.title}>
            {weeks !== null ? `Week ${weeks}` : 'Pregnancy Progress'}
          </Text>
          {trimester && (
            <Text style={styles.trimesterText}>Trimester {trimester}</Text>
          )}
        </View>

        {/* Baby Silhouette Icon matching web base.php baby_silhouette_svg */}
        <View style={styles.silhouetteWrap}>
          <Svg width={64} height={64} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="46" fill={Colors.primaryLight} opacity={0.65} />
            <Path
              d="M62 28c10 4 14 16 10 27-3 8-2 15 4 20-9 6-22 4-29-4-6-7-14-9-18-6 1-11 8-19 16-23-4-7-2-16 5-20 4-2 9-1 12 6z"
              fill={Colors.primaryDark}
              opacity={0.85}
            />
            <Circle cx="40" cy="38" r="7" fill={Colors.primaryDark} />
          </Svg>
        </View>
      </View>

      {/* Fruit Comparison Box */}
      <View style={styles.comparisonBox}>
        <Text style={styles.comparisonLabel}>ABOUT THE SIZE OF A</Text>
        <View style={styles.fruitRow}>
          <Text style={styles.fruitText}>{babyFruit || 'Growing Baby'}</Text>
          <Text style={styles.emojiText}>{babyEmoji || '👶'}</Text>
        </View>
      </View>

      {/* Due Date Countdown Pill */}
      <View style={styles.footerRow}>
        <View style={styles.duePill}>
          <Text style={styles.duePillText}>
            {daysToEdd !== null && daysToEdd >= 0
              ? `⏳ ${daysToEdd} days until expected due date`
              : edd
              ? `Due: ${edd}`
              : 'Set LMP to calculate countdown'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  trimesterText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textSoft,
    marginTop: 1,
  },
  silhouetteWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonBox: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  comparisonLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fruitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fruitText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emojiText: {
    fontSize: 24,
  },
  footerRow: {
    flexDirection: 'row',
  },
  duePill: {
    backgroundColor: Colors.secondarySoft,
    borderWidth: 1,
    borderColor: Colors.secondaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  duePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.secondaryDark,
  },
});
