import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Shadows } from '../theme/colors';

interface BabySizeCardProps {
  weeks: number | null;
  days?: number | null;
  trimester?: number | null;
  babyFruit?: string;
  babyEmoji?: string;
  daysToEdd?: number | null;
  edd?: string | null;
}

export const BabySizeCard: React.FC<BabySizeCardProps> = ({
  weeks = 27,
  babyFruit = 'Rutabaga',
  babyEmoji = '🟤',
  daysToEdd = 90,
  edd,
}) => {
  const currentWeek = weeks !== null && weeks !== undefined ? weeks : 27;
  const fruitName = babyFruit || 'Rutabaga';
  const fruitEmoji = babyEmoji || '🟤';
  const countdownDays = daysToEdd !== null && daysToEdd !== undefined ? daysToEdd : 90;

  return (
    <View style={[styles.card, Shadows.card]}>
      {/* 1. Curled Baby Silhouette Section */}
      <View style={styles.sectionCenter}>
        <View style={styles.silhouetteWrap}>
          <Svg width={80} height={80} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="46" fill="#FFAFCC" opacity={0.22} />
            <Path
              d="M62 28c10 4 14 16 10 27-3 8-2 15 4 20-9 6-22 4-29-4-6-7-14-9-18-6 1-11 8-19 16-23-4-7-2-16 5-20 4-2 9-1 12 6z"
              fill="#FFAFCC"
              opacity={0.88}
            />
            <Circle cx="40" cy="38" r="7" fill="#FFAFCC" />
          </Svg>
        </View>
        <Text style={styles.illustrativeText}>Illustrative only</Text>
      </View>

      {/* 2. Baby Size This Week Section */}
      <View style={styles.sectionCenter}>
        <Text style={styles.eyebrow}>BABY'S SIZE THIS WEEK</Text>
        <View style={styles.emojiWrap}>
          <Text style={styles.emojiText}>{fruitEmoji}</Text>
        </View>
        <Text style={styles.fruitHeading}>About the size of a {fruitName}</Text>
        <Text style={styles.weekSubtext}>Week {currentWeek} of 40</Text>
      </View>

      {/* 3. Countdown To Due Date Section */}
      <View style={[styles.sectionCenter, { marginBottom: 4 }]}>
        <Text style={styles.eyebrow}>COUNTDOWN TO DUE DATE</Text>
        {countdownDays !== null && countdownDays > 0 ? (
          <>
            <Text style={styles.countdownNumber}>{countdownDays}</Text>
            <Text style={styles.weekSubtext}>days to go</Text>
          </>
        ) : countdownDays !== null ? (
          <Text style={styles.countdownAnyday}>Any day now! 🎉</Text>
        ) : edd ? (
          <Text style={styles.countdownDate}>Due: {edd}</Text>
        ) : (
          <Text style={styles.weekSubtext}>Add your LMP in Profile to see this.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    alignItems: 'center',
    gap: 16,
  },
  sectionCenter: {
    alignItems: 'center',
    width: '100%',
  },
  silhouetteWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrativeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.primaryDark,
    marginBottom: 6,
    textAlign: 'center',
  },
  emojiWrap: {
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  fruitHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 2,
  },
  weekSubtext: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  countdownNumber: {
    fontSize: 42,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.primaryDark,
    lineHeight: 48,
    textAlign: 'center',
  },
  countdownAnyday: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.primaryDark,
    marginTop: 4,
    textAlign: 'center',
  },
  countdownDate: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 4,
    textAlign: 'center',
  },
});
