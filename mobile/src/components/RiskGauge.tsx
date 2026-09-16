import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Colors } from '../theme/colors';

interface RiskGaugeProps {
  score: number;
  level: 'Low' | 'High' | 'Severe' | 'None';
  size?: number;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, level, size = 190 }) => {
  const safeScore = Math.min(100, Math.max(0, score || 0));

  // Geometry matching base.php risk_gauge_svg()
  const cx = size / 2;
  const cy = size * 0.58;
  const r = size * 0.42;

  const angle = -90 + (safeScore / 100) * 180;
  const rad = ((angle - 90) * Math.PI) / 180;
  const nx = cx + r * 0.78 * Math.cos(rad);
  const ny = cy + r * 0.78 * Math.sin(rad);

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const trackPath = describeArc(cx, cy, r, -90, 90);
  const fillPath = describeArc(cx, cy, r, -90, angle);

  const getColor = () => {
    switch (level) {
      case 'Severe':
        return Colors.riskHigh;   // #E15D74
      case 'High':
        return Colors.riskMod;    // #E0A24A
      case 'Low':
        return Colors.riskLow;    // #6FAE82
      default:
        return Colors.textMuted;
    }
  };

  const getBgColor = () => {
    switch (level) {
      case 'Severe':
        return Colors.riskHighBg; // #FCE4E9
      case 'High':
        return Colors.riskModBg;  // #FCF1DD
      case 'Low':
        return Colors.riskLowBg;  // #E7F4EB
      default:
        return Colors.backgroundSoft;
    }
  };

  const color = getColor();
  const bgColor = getBgColor();
  const height = size * 0.68;

  return (
    <View style={[styles.container, { width: size }]}>
      <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        <Path d={trackPath} fill="none" stroke={Colors.backgroundSoft} strokeWidth="16" strokeLinecap="round" />
        <Path d={fillPath} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" />
        <Circle cx={cx} cy={cy} r="6" fill={Colors.text} />
        <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={Colors.text} strokeWidth="3.5" strokeLinecap="round" />
      </Svg>

      <View style={styles.infoRow}>
        <Text style={[styles.scoreText, { color: Colors.text }]}>
          {score !== null && score !== undefined ? score : '—'}
        </Text>
        <View style={[styles.badge, { backgroundColor: bgColor }]}>
          <Text style={[styles.badgeText, { color }]}>
            {level ? `${level} Risk` : 'No Assessment'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    marginTop: -18,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
