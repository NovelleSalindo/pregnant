import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { getMilestoneForWeek } from '../data/pregnancyMilestones';

interface BabySizeCardProps {
  weeks: number | null;
  days?: number | null;
  trimester?: number | null;
  babyFruit?: string;
  babyEmoji?: string;
  daysToEdd?: number | null;
  edd?: string | null;
  isDarkMode?: boolean;
}

const BABY_MONTH_IMAGES: Record<number, any> = {
  1: require('../../assets/baby_months/month_1.png'),
  2: require('../../assets/baby_months/month_2.png'),
  3: require('../../assets/baby_months/month_3.png'),
  4: require('../../assets/baby_months/month_4.png'),
  5: require('../../assets/baby_months/month_5.png'),
  6: require('../../assets/baby_months/month_6.png'),
  7: require('../../assets/baby_months/month_7.png'),
  8: require('../../assets/baby_months/month_8.png'),
  9: require('../../assets/baby_months/month_9.png'),
};

const BABY_MONTHS_FULL = require('../../assets/baby_size_months_hd.jpg');

export function getPregnancyMonth(week: number): number {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  if (week <= 13) return 3;
  if (week <= 17) return 4;
  if (week <= 21) return 5;
  if (week <= 26) return 6;
  if (week <= 30) return 7;
  if (week <= 35) return 8;
  return 9;
}

export interface MonthInfo {
  month: number;
  weeks: string;
  sizeLength: string;
  weight: string;
  fruitCompare: string;
  highlights: string;
  anatomy: string;
}

export const MONTH_DATA: Record<number, MonthInfo> = {
  1: {
    month: 1,
    weeks: 'Weeks 1 - 4',
    sizeLength: '~0.2 cm',
    weight: '< 1 g',
    fruitCompare: 'Poppy Seed',
    highlights: 'Fertilization and implantation in the uterine lining. The amniotic sac and placenta start forming.',
    anatomy: 'Rapid cell division transforms the blastocyst into an embryo. Foundations for neural tube begin.',
  },
  2: {
    month: 2,
    weeks: 'Weeks 5 - 8',
    sizeLength: '~1.6 cm',
    weight: '~1 g',
    fruitCompare: 'Raspberry',
    highlights: 'Heart begins beating at 100-160 bpm! Tiny limb buds for arms and legs appear and develop.',
    anatomy: 'Neural tube closes; facial features including eyes, nose, and tiny jaw start shaping.',
  },
  3: {
    month: 3,
    weeks: 'Weeks 9 - 13',
    sizeLength: '~7.4 cm',
    weight: '~23 g',
    fruitCompare: 'Lemon',
    highlights: 'All essential organs and limbs are formed. Baby can open and close tiny fists and curl toes.',
    anatomy: 'Unique fingerprints are established. Reflexes develop as baby swallows amniotic fluid.',
  },
  4: {
    month: 4,
    weeks: 'Weeks 14 - 17',
    sizeLength: '~13 cm',
    weight: '~140 g',
    fruitCompare: 'Avocado',
    highlights: 'Baby can suck their thumb and make cute facial expressions! Genitals are discernible on ultrasound.',
    anatomy: 'Fine downy hair (lanugo) covers the body. Cartilage skeleton begins transforming into bone.',
  },
  5: {
    month: 5,
    weeks: 'Weeks 18 - 21',
    sizeLength: '~26 cm',
    weight: '~360 g',
    fruitCompare: 'Banana',
    highlights: 'Quickening! You can feel the first flutter kicks. Baby develops regular sleep-wake cycles.',
    anatomy: 'Vernix caseosa coating protects baby’s skin. Eyebrows, eyelashes, and head hair start growing.',
  },
  6: {
    month: 6,
    weeks: 'Weeks 22 - 26',
    sizeLength: '~35 cm',
    weight: '~760 g',
    fruitCompare: 'Eggplant',
    highlights: 'Baby hears your voice and heartbeat! Eyelids flutter open and baby responds to music and belly touch.',
    anatomy: 'Lungs begin producing surfactant for breathing. Finger and toe nails are fully developed.',
  },
  7: {
    month: 7,
    weeks: 'Weeks 27 - 30',
    sizeLength: '~40 cm',
    weight: '~1.3 kg',
    fruitCompare: 'Cabbage',
    highlights: 'Baby’s eyes open and perceive light. Rapid brain growth and REM sleep (dreaming) begins.',
    anatomy: 'Billions of brain neurons form. Subcutaneous fat deposits increase to regulate body temperature.',
  },
  8: {
    month: 8,
    weeks: 'Weeks 31 - 35',
    sizeLength: '~46 cm',
    weight: '~2.4 kg',
    fruitCompare: 'Honeydew Melon',
    highlights: 'Rapid weight gain. Kicks and turns are strong and visible. Most babies begin turning head-down.',
    anatomy: 'Bones are fully developed though skull remains pliable for birth. Immune antibodies absorb from mother.',
  },
  9: {
    month: 9,
    weeks: 'Weeks 36 - 40',
    sizeLength: '~51 cm',
    weight: '~3.4 kg',
    fruitCompare: 'Watermelon / Full Term',
    highlights: 'Full-term baby! Lungs are mature, vernix sheds, and baby settles low into your pelvis ready for delivery.',
    anatomy: 'All organ systems are primed for birth. Baby gains about 200g each week in the final home stretch.',
  },
};

export const BabySizeCard: React.FC<BabySizeCardProps> = ({
  weeks = 27,
  babyFruit,
  babyEmoji,
  daysToEdd = 90,
  edd,
  isDarkMode = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);

  const currentWeek = weeks !== null && weeks !== undefined ? weeks : 27;
  const currentMonth = getPregnancyMonth(currentWeek);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const milestone = getMilestoneForWeek(currentWeek);
  const fruitName = babyFruit || milestone.sizeName;
  const fruitEmoji = babyEmoji || milestone.emoji;
  const countdownDays = daysToEdd !== null && daysToEdd !== undefined ? daysToEdd : 90;

  const monthInfo = MONTH_DATA[selectedMonth] || MONTH_DATA[currentMonth];

  return (
    <>
      <View
        style={[
          styles.card,
          Shadows.card,
          isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
        ]}
      >
        {/* 1. Illustrative Baby Size by Month Section */}
        <View style={styles.sectionCenter}>
          <TouchableOpacity
            style={styles.silhouetteWrap}
            activeOpacity={0.85}
            onPress={() => {
              setSelectedMonth(currentMonth);
              setChartModalVisible(true);
            }}
            accessibilityLabel="View 9-month fetal development chart"
          >
            <View style={[styles.babyImageCircle, isDarkMode && styles.babyImageCircleDark]}>
              <Image
                source={BABY_MONTH_IMAGES[currentMonth] || BABY_MONTH_IMAGES[9]}
                style={styles.babyFetusImage}
                resizeMode="cover"
              />
              <View style={[styles.monthBadgeOverlay, isDarkMode && { backgroundColor: '#2D1B28', borderColor: '#FF94B8' }]}>
                <Text style={styles.monthBadgeOverlayText}>Mo {currentMonth}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSelectedMonth(currentMonth);
              setChartModalVisible(true);
            }}
            activeOpacity={0.7}
            style={styles.illustrativeLabelRow}
          >
            <Ionicons name="sparkles" size={12} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
            <Text style={[styles.illustrativeText, isDarkMode && { color: '#F0EEF0' }]}>
              Month {currentMonth} of 9 • Illustrative Fetal Size
            </Text>
            <Ionicons name="chevron-forward" size={12} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* 2. Weekly Development Tips Button */}
        <View style={styles.sectionCenter}>
          <TouchableOpacity
            style={[styles.milestoneBtn, isDarkMode && { backgroundColor: '#261922', borderColor: '#4A2534' }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Explore weekly milestones"
          >
            <Ionicons name="sparkles" size={14} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
            <Text style={[styles.milestoneBtnText, isDarkMode && { color: '#FF94B8' }]}>
              See Week {currentWeek} Development & Tips
            </Text>
            <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* 3. Countdown To Due Date Section */}
        <View style={[styles.sectionCenter, { marginBottom: 4 }]}>
          <Text style={[styles.eyebrow, isDarkMode && { color: '#FF94B8' }]}>
            COUNTDOWN TO DUE DATE
          </Text>
          {countdownDays !== null && countdownDays > 0 ? (
            <>
              <Text style={[styles.countdownNumber, isDarkMode && { color: '#FF94B8' }]}>
                {countdownDays}
              </Text>
              <Text style={[styles.weekSubtext, isDarkMode && { color: '#85818A' }]}>
                days to go • Week {currentWeek} of 40
              </Text>
            </>
          ) : countdownDays !== null ? (
            <Text style={[styles.countdownAnyday, isDarkMode && { color: '#FF94B8' }]}>
              Any day now! 🎉
            </Text>
          ) : edd ? (
            <Text style={[styles.countdownDate, isDarkMode && { color: '#FF94B8' }]}>
              Due: {edd}
            </Text>
          ) : (
            <Text style={[styles.weekSubtext, isDarkMode && { color: '#85818A' }]}>
              Add your LMP in Profile to see this.
            </Text>
          )}
        </View>
      </View>

      {/* ================= 9-Month Fetal Development Chart Modal ================= */}
      <Modal
        visible={chartModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChartModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setChartModalVisible(false)}>
          <Pressable
            style={[
              styles.modalSheet,
              Shadows.large,
              isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.chartHeaderIcon}>
                  <Ionicons name="calendar-outline" size={22} color={Colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chartModalTitle, isDarkMode && { color: '#F0EEF0' }]}>
                    Fetal Size by Month
                  </Text>
                  <Text style={[styles.chartModalSub, isDarkMode && { color: '#85818A' }]}>
                    1 to 9 Months Developmental Progression
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setChartModalVisible(false)}
                  style={styles.modalCloseIconBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={isDarkMode ? '#85818A' : Colors.textSoft} />
                </TouchableOpacity>
              </View>

              {/* Full 9-Month Visual Diagram */}
              <View style={[styles.fullChartWrap, isDarkMode && { backgroundColor: '#111114', borderColor: '#2C2C31' }]}>
                <Image
                  source={BABY_MONTHS_FULL}
                  style={styles.fullChartImage}
                  resizeMode="contain"
                />
              </View>

              {/* Month Selector Strip */}
              <Text style={[styles.selectorLabel, isDarkMode && { color: '#85818A' }]}>
                SELECT MONTH TO VIEW DETAILS:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthStrip}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => {
                  const isCurrent = m === currentMonth;
                  const isSelected = m === selectedMonth;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSelectedMonth(m)}
                      activeOpacity={0.7}
                      style={[
                        styles.monthTabBtn,
                        isSelected && styles.monthTabBtnActive,
                        isDarkMode && { backgroundColor: isSelected ? '#C2577D' : '#261922', borderColor: isSelected ? '#FF94B8' : '#3A2530' },
                      ]}
                    >
                      <Text style={[
                        styles.monthTabBtnText,
                        isSelected && styles.monthTabBtnTextActive,
                        isDarkMode && !isSelected && { color: '#85818A' },
                      ]}>
                        Month {m}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentMonthDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Selected Month Detail Card */}
              <View style={[styles.selectedMonthCard, isDarkMode && { backgroundColor: '#261922', borderColor: '#3A2530' }]}>
                <View style={styles.monthCardHeader}>
                  <Image
                    source={BABY_MONTH_IMAGES[selectedMonth] || BABY_MONTH_IMAGES[9]}
                    style={styles.monthThumbImage}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={styles.monthBadgeRow}>
                      <Text style={[styles.monthCardTitle, isDarkMode && { color: '#F0EEF0' }]}>
                        Month {monthInfo.month}
                      </Text>
                      {selectedMonth === currentMonth && (
                        <View style={styles.youAreHereBadge}>
                          <Text style={styles.youAreHereText}>CURRENT MONTH</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.monthCardWeeks, isDarkMode && { color: '#FF94B8' }]}>
                      {monthInfo.weeks}
                    </Text>
                    <View style={styles.monthMetricsRow}>
                      <View style={styles.metricPill}>
                        <Ionicons name="resize-outline" size={12} color={Colors.primaryDark} />
                        <Text style={styles.metricPillText}>{monthInfo.sizeLength}</Text>
                      </View>
                      <View style={styles.metricPill}>
                        <Ionicons name="scale-outline" size={12} color={Colors.primaryDark} />
                        <Text style={styles.metricPillText}>{monthInfo.weight}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Highlights */}
                <View style={[styles.monthInfoBox, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                  <Text style={[styles.monthInfoHead, isDarkMode && { color: '#FF94B8' }]}>
                    ✨ Growth & Highlights
                  </Text>
                  <Text style={[styles.monthInfoBody, isDarkMode && { color: '#D1D5DB' }]}>
                    {monthInfo.highlights}
                  </Text>
                </View>

                {/* Anatomy */}
                <View style={[styles.monthInfoBox, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                  <Text style={[styles.monthInfoHead, isDarkMode && { color: '#FF94B8' }]}>
                    🔬 Anatomical Milestones
                  </Text>
                  <Text style={[styles.monthInfoBody, isDarkMode && { color: '#D1D5DB' }]}>
                    {monthInfo.anatomy}
                  </Text>
                </View>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setChartModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalDoneBtnText}>Close Chart</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Week Development & Care Tips Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable
            style={[
              styles.modalSheet,
              Shadows.large,
              isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalEmojiBadge}>
                  <Text style={styles.modalEmojiText}>{milestone.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.modalWeekTag}>
                    <Text style={styles.modalWeekTagText}>WEEK {currentWeek} MILESTONE</Text>
                  </View>
                  <Text style={[styles.modalFruitTitle, isDarkMode && { color: '#F0EEF0' }]}>
                    Size: {milestone.sizeName}
                  </Text>
                  <Text style={[styles.modalMetrics, isDarkMode && { color: '#85818A' }]}>
                    ~{milestone.lengthApprox}  •  ~{milestone.weightApprox}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCloseIconBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={isDarkMode ? '#85818A' : Colors.textSoft} />
                </TouchableOpacity>
              </View>

              {/* 1. Baby's Development */}
              <View style={[styles.infoBlock, isDarkMode && { backgroundColor: '#261922', borderColor: '#4A2534' }]}>
                <View style={styles.infoBlockTitleRow}>
                  <Ionicons name="heart" size={16} color={Colors.primaryDark} />
                  <Text style={[styles.infoBlockTitle, isDarkMode && { color: '#F0EEF0' }]}>
                    Baby's Growth & Changes
                  </Text>
                </View>
                <Text style={[styles.infoBlockBody, isDarkMode && { color: '#85818A' }]}>
                  {milestone.babyDevelopment}
                </Text>
              </View>

              {/* 2. Mom's Body Symptoms */}
              <View style={[styles.infoBlock, isDarkMode && { backgroundColor: '#261922', borderColor: '#4A2534' }]}>
                <View style={styles.infoBlockTitleRow}>
                  <Ionicons name="fitness" size={16} color={Colors.primaryDark} />
                  <Text style={[styles.infoBlockTitle, isDarkMode && { color: '#F0EEF0' }]}>
                    Common Symptoms This Week
                  </Text>
                </View>
                <Text style={[styles.infoBlockBody, isDarkMode && { color: '#85818A' }]}>
                  {milestone.momSymptoms}
                </Text>
              </View>

              {/* 3. Clinical Tip of the Week */}
              <View style={[styles.infoBlock, styles.tipBlock, isDarkMode && { backgroundColor: '#2C2210', borderColor: '#59441B' }]}>
                <View style={styles.infoBlockTitleRow}>
                  <Ionicons name="bulb" size={16} color="#D97706" />
                  <Text style={[styles.infoBlockTitle, isDarkMode && { color: '#FDE68A' }]}>
                    Care Tip for Week {currentWeek}
                  </Text>
                </View>
                <Text style={[styles.infoBlockBody, isDarkMode && { color: '#FDE68A' }]}>
                  {milestone.weeklyTip}
                </Text>
              </View>

              {/* Done Button */}
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalDoneBtnText}>Got It</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyImageCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFF0F5',
    borderWidth: 2,
    borderColor: '#FFD6E5',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  babyImageCircleDark: {
    backgroundColor: '#261922',
    borderColor: '#4A2534',
  },
  babyFetusImage: {
    width: 84,
    height: 84,
  },
  monthBadgeOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#C2577D',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  monthBadgeOverlayText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  illustrativeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  illustrativeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textMuted,
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
  milestoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FFD6E5',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  milestoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  chartHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'serif',
    color: Colors.text,
  },
  chartModalSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  fullChartWrap: {
    width: '100%',
    height: 220,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 14,
  },
  fullChartImage: {
    width: '100%',
    height: '100%',
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  monthStrip: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  monthTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    alignItems: 'center',
    position: 'relative',
  },
  monthTabBtnActive: {
    backgroundColor: '#C2577D',
    borderColor: '#C2577D',
  },
  monthTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  monthTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  currentMonthDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  selectedMonthCard: {
    backgroundColor: '#FAF5FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EADFF0',
    padding: 14,
    marginBottom: 14,
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthThumbImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFD6E5',
  },
  monthBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  youAreHereBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youAreHereText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  monthCardWeeks: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  monthMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  metricPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  monthInfoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    marginBottom: 8,
  },
  monthInfoHead: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  monthInfoBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textSoft,
  },
  modalEmojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmojiText: {
    fontSize: 26,
  },
  modalWeekTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE4EE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  modalWeekTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  modalFruitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalMetrics: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  infoBlock: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  tipBlock: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  infoBlockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoBlockTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
  },
  infoBlockBody: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSoft,
  },
  modalDoneBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  modalDoneBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
