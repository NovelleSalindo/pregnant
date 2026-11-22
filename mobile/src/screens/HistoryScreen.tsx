import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, G, Line, Text as SvgText, Polyline, Circle, Rect } from 'react-native-svg';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

const { width } = Dimensions.get('window');

interface HistoryScreenProps {
  onNavigate?: (tab: string, subTab?: string) => void;
  isDarkMode?: boolean;
}

type HistoryTab = 'children' | 'vitals' | 'risk' | 'symptoms';

// ── SVG Trend Chart for Vitals Trends ──
interface VitalsTrendChartProps {
  items: any[];
  metric: 'bp' | 'weight';
  isDarkMode?: boolean;
}

const VitalsTrendChart: React.FC<VitalsTrendChartProps> = ({ items, metric, isDarkMode }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (items && items.length > 0) {
      setSelectedIdx(items.length - 1);
    } else {
      setSelectedIdx(null);
    }
  }, [items]);

  if (!items || items.length === 0) {
    return (
      <View style={[styles.trendEmptyBox, isDarkMode && { backgroundColor: '#1E1924' }]}>
        <Ionicons name="trending-up-outline" size={28} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
        <Text style={[styles.trendEmptyText, isDarkMode && { color: '#85818A' }]}>
          No vitals logged yet for this selection.
        </Text>
      </View>
    );
  }

  const n = items.length;
  const plotLeft = 44;
  // Dynamic column spacing so labels never collide and user can smoothly scroll horizontally
  const colWidth = Math.max(68, Math.floor((width - 80) / Math.max(1, n)));
  const plotW = Math.max(width - 80, (n - 1) * colWidth);
  const plotRight = plotLeft + plotW;
  const plotTop = 24;
  const plotBottom = 160;
  const plotH = plotBottom - plotTop;
  const svgWidth = Math.max(width - 32, plotRight + 45);

  let yMin = 60;
  let yMax = 160;
  let step = 20;

  if (metric === 'bp') {
    const sysArr = items.filter(it => it.avg_sys).map(it => Number(it.avg_sys));
    const diaArr = items.filter(it => it.avg_dia).map(it => Number(it.avg_dia));
    const minVal = diaArr.length ? Math.min(...diaArr) : 60;
    const maxVal = sysArr.length ? Math.max(...sysArr) : 140;
    yMin = Math.max(40, Math.floor((minVal - 10) / 20) * 20);
    yMax = Math.max(160, Math.ceil((maxVal + 10) / 20) * 20);
    if (yMax - yMin < 60) { yMin = 60; yMax = 160; }
    step = (yMax - yMin > 120) ? 30 : 20;
  } else {
    const wtArr = items.filter(it => it.avg_weight).map(it => Number(it.avg_weight));
    const minVal = wtArr.length ? Math.min(...wtArr) : 50;
    const maxVal = wtArr.length ? Math.max(...wtArr) : 70;
    yMin = Math.max(30, Math.floor((minVal - 3) / 5) * 5);
    yMax = Math.ceil((maxVal + 3) / 5) * 5;
    if (yMax - yMin < 15) { yMin = Math.max(30, yMin - 5); yMax += 10; }
    step = 5;
  }

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) {
    yTicks.push(v);
  }

  const getY = (val: number) => {
    if (yMax === yMin) return (plotTop + plotBottom) / 2;
    const ratio = (val - yMin) / (yMax - yMin);
    return plotBottom - (ratio * plotH);
  };

  const getX = (idx: number) => {
    if (n <= 1) return plotLeft + (plotW / 2);
    return plotLeft + (idx * colWidth);
  };

  const gridColor = isDarkMode ? '#2C2C31' : '#E2E8F0';
  const labelColor = isDarkMode ? '#85818A' : '#64748B';

  const sysPoints: [number, number, number, number][] = [];
  const diaPoints: [number, number, number, number][] = [];
  const wtPoints: [number, number, number, number][] = [];

  for (let i = 0; i < n; i++) {
    const x = getX(i);
    if (items[i].avg_sys) sysPoints.push([x, getY(items[i].avg_sys), items[i].avg_sys, i]);
    if (items[i].avg_dia) diaPoints.push([x, getY(items[i].avg_dia), items[i].avg_dia, i]);
    if (items[i].avg_weight) wtPoints.push([x, getY(items[i].avg_weight), items[i].avg_weight, i]);
  }

  const activeItem = (selectedIdx !== null && items[selectedIdx]) ? items[selectedIdx] : null;
  const selX = (selectedIdx !== null) ? getX(selectedIdx) : null;

  // BP Status badge
  let bpBadge = null;
  if (activeItem && metric === 'bp' && activeItem.avg_sys && activeItem.avg_dia) {
    const s = Number(activeItem.avg_sys);
    const d = Number(activeItem.avg_dia);
    if (s >= 140 || d >= 90) {
      bpBadge = { label: 'High BP (Stage 2)', bg: '#FEE2E2', text: '#DC2626' };
    } else if (s >= 130 || d >= 80) {
      bpBadge = { label: 'Stage 1', bg: '#FEF3C7', text: '#D97706' };
    } else if (s >= 120 && d < 80) {
      bpBadge = { label: 'Elevated', bg: '#FEF9C3', text: '#CA8A04' };
    } else {
      bpBadge = { label: 'Normal', bg: '#DCFCE7', text: '#16A34A' };
    }
  }

  return (
    <View style={{ marginBottom: 12 }}>
      {/* ── Active Hover / Tap Tooltip Box ── */}
      <View style={[styles.trendTooltipBox, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
        <View style={styles.trendTooltipHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Ionicons name="calendar-outline" size={15} color={Colors.primary} />
            <Text style={[styles.trendTooltipDate, { color: isDarkMode ? '#F0EEF0' : '#1E293B' }]}>
              {activeItem ? (activeItem.label || activeItem.period) : 'Hover or tap a point to inspect'}
            </Text>
          </View>
          <Text style={[styles.trendTooltipHint, { color: labelColor }]}>
            {activeItem && selectedIdx !== null ? `Point ${selectedIdx + 1} of ${n}` : 'Hover / tap'}
          </Text>
        </View>

        {activeItem ? (
          <View style={styles.trendTooltipValuesRow}>
            {metric === 'bp' ? (
              <>
                <View style={styles.trendValuePill}>
                  <View style={[styles.miniDot, { backgroundColor: '#C2577D' }]} />
                  <Text style={[styles.trendValueLabel, { color: labelColor }]}>Systolic:</Text>
                  <Text style={[styles.trendValueNum, { color: '#C2577D' }]}>
                    {activeItem.avg_sys ? `${activeItem.avg_sys} mmHg` : '—'}
                  </Text>
                </View>
                <View style={styles.trendValuePill}>
                  <View style={[styles.miniDot, { backgroundColor: '#02848F' }]} />
                  <Text style={[styles.trendValueLabel, { color: labelColor }]}>Diastolic:</Text>
                  <Text style={[styles.trendValueNum, { color: '#02848F' }]}>
                    {activeItem.avg_dia ? `${activeItem.avg_dia} mmHg` : '—'}
                  </Text>
                </View>
                {bpBadge && (
                  <View style={[styles.trendStatusBadge, { backgroundColor: bpBadge.bg }]}>
                    <Text style={[styles.trendStatusBadgeText, { color: bpBadge.text }]}>{bpBadge.label}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.trendValuePill}>
                <View style={[styles.miniDot, { backgroundColor: '#246944' }]} />
                <Text style={[styles.trendValueLabel, { color: labelColor }]}>Weight:</Text>
                <Text style={[styles.trendValueNum, { color: '#246944' }]}>
                  {activeItem.avg_weight ? `${activeItem.avg_weight} kg` : '—'}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* ── Interactive Horizontal Scroll Chart ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginBottom: 4 }}>
        <Svg width={svgWidth} height={215}>
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <G key={`ytick-${tick}`}>
                <Line x1={plotLeft} y1={y} x2={plotRight + 15} y2={y} stroke={gridColor} strokeWidth="1" strokeDasharray="3,3" />
                <SvgText x={plotLeft - 6} y={y + 4} textAnchor="end" fontSize="10" fontWeight="600" fill={labelColor}>
                  {tick}
                </SvgText>
              </G>
            );
          })}

          <Line x1={plotLeft} y1={plotBottom} x2={plotRight + 15} y2={plotBottom} stroke={gridColor} strokeWidth="1.5" />

          {/* Active Hover / Selected Vertical Line */}
          {selX !== null && (
            <Line
              x1={selX}
              y1={plotTop - 6}
              x2={selX}
              y2={plotBottom + 10}
              stroke={isDarkMode ? '#F43F5E' : Colors.primary}
              strokeWidth={1.8}
              strokeDasharray="4,3"
            />
          )}

          {/* X Axis Date Labels */}
          {items.map((it, idx) => {
            const x = getX(idx);
            const isSel = selectedIdx === idx;
            let lbl = it.short_label || it.period || '';
            // If it contains a comma like 'Nov 22, 10:50pm', display clean date
            if (lbl.includes(',')) {
              lbl = lbl.split(',')[0].trim();
            }

            return (
              <G key={`xtick-${idx}`}>
                {isSel && (
                  <Circle cx={x} cy={plotBottom + 7} r={3} fill={isDarkMode ? '#F43F5E' : Colors.primary} />
                )}
                <SvgText
                  x={x}
                  y={plotBottom + (isSel ? 22 : 18)}
                  textAnchor="middle"
                  fontSize={isSel ? "10.5" : "9"}
                  fontWeight={isSel ? "800" : "600"}
                  fill={isSel ? (isDarkMode ? '#F43F5E' : Colors.primary) : labelColor}
                >
                  {lbl}
                </SvgText>
              </G>
            );
          })}

          {metric === 'bp' ? (
            <>
              {diaPoints.length > 1 && (
                <Polyline
                  points={diaPoints.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ')}
                  fill="none"
                  stroke="#02848F"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {diaPoints.map((p, idx) => {
                const isSel = selectedIdx === p[3];
                return (
                  <G key={`dia-pt-${idx}`}>
                    {isSel && (
                      <Circle cx={p[0]} cy={p[1]} r={7.5} fill="#02848F" opacity={0.3} />
                    )}
                    <Circle cx={p[0]} cy={p[1]} r={isSel ? 5 : 4} fill="#02848F" stroke="#FFF" strokeWidth={isSel ? 2 : 1.5} />
                  </G>
                );
              })}

              {sysPoints.length > 1 && (
                <Polyline
                  points={sysPoints.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ')}
                  fill="none"
                  stroke="#C2577D"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {sysPoints.map((p, idx) => {
                const isSel = selectedIdx === p[3];
                return (
                  <G key={`sys-pt-${idx}`}>
                    {isSel && (
                      <Circle cx={p[0]} cy={p[1]} r={8} fill="#C2577D" opacity={0.3} />
                    )}
                    <Circle cx={p[0]} cy={p[1]} r={isSel ? 5.5 : 4.5} fill="#C2577D" stroke="#FFF" strokeWidth={isSel ? 2 : 1.5} />
                  </G>
                );
              })}
            </>
          ) : (
            <>
              {wtPoints.length > 1 && (
                <Polyline
                  points={wtPoints.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ')}
                  fill="none"
                  stroke="#246944"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {wtPoints.map((p, idx) => {
                const isSel = selectedIdx === p[3];
                return (
                  <G key={`wt-pt-${idx}`}>
                    {isSel && (
                      <Circle cx={p[0]} cy={p[1]} r={8} fill="#246944" opacity={0.3} />
                    )}
                    <Circle cx={p[0]} cy={p[1]} r={isSel ? 5.5 : 4.5} fill="#246944" stroke="#FFF" strokeWidth={isSel ? 2 : 1.5} />
                  </G>
                );
              })}
            </>
          )}

          {/* Interactive Touch & Hover Hitboxes across all columns */}
          {items.map((_, idx) => {
            const x = getX(idx);
            return (
              <Rect
                key={`hitbox-${idx}`}
                x={x - (colWidth / 2)}
                y={plotTop - 15}
                width={colWidth}
                height={plotH + 50}
                fill="transparent"
                onPress={() => setSelectedIdx(idx)}
                // @ts-ignore Web hover
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
};

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onNavigate, isDarkMode = false }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<HistoryTab>('children');
  const [selectedPregId, setSelectedPregId] = useState<string>('all');
  const [historyData, setHistoryData] = useState<any>(null);
  const [trendTimeframe, setTrendTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [trendMetric, setTrendMetric] = useState<'bp' | 'weight'>('bp');

  const fetchHistory = useCallback(async (pregId = selectedPregId) => {
    try {
      const res: any = await api.getHistory(pregId);
      if (res) {
        const payload = (res.data && res.data.pregnancies) ? res.data : (res.pregnancies ? res : (res.data || res));
        setHistoryData(payload);
      }
    } catch (err) {
      console.warn('[HistoryScreen Fetch Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPregId]);

  useEffect(() => {
    fetchHistory(selectedPregId);
  }, [selectedPregId, fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(selectedPregId);
  };

  const handleSelectFilter = (id: string) => {
    setSelectedPregId(id);
    setLoading(true);
  };

  const handleSwitchActive = async (pregId: string) => {
    try {
      setLoading(true);
      await api.switchPregnancy(pregId);
      await fetchHistory(selectedPregId);
      Alert.alert('Active Pregnancy Changed', 'You have set this child as your current active pregnancy.');
    } catch (e: any) {
      console.warn('Switch pregnancy error', e);
      Alert.alert('Notice', e?.message || 'Could not switch active pregnancy.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !historyData) {
    return (
      <View style={[styles.center, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, isDarkMode && { color: '#85818A' }]}>
          Loading pregnancy & health history...
        </Text>
      </View>
    );
  }

  const pregnancies: any[] = historyData?.pregnancies || [];
  const summaries: Record<string, any> = historyData?.pregnancy_summaries || {};
  const vitals: any[] = historyData?.vitals || [];
  const trends: any = historyData?.trends || {};
  const riskAssessments: any[] = historyData?.risk_assessments || [];
  const clinicalVisits: any[] = historyData?.clinical_visits || [];
  const symptomLogs: any[] = historyData?.symptom_logs || [];
  const summary: any = historyData?.summary || {};
  const activePregId = historyData?.active_pregnancy_id;

  const bg = isDarkMode ? '#0A0A0C' : '#F8F6F8';
  const cardBg = isDarkMode ? '#1A1A1E' : '#FFFFFF';
  const border = isDarkMode ? '#2C2C31' : '#F1E6EC';
  const textColor = isDarkMode ? '#F0EEF0' : '#1E293B';
  const mutedColor = isDarkMode ? '#85818A' : '#64748B';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* ── Top Header Banner ── */}
      <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIconCircle, { backgroundColor: isDarkMode ? '#3A1820' : '#FFF0F5' }]}>
            <Ionicons name="time" size={26} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.heroTitle, { color: textColor }]}>Pregnancy & Health History</Text>
            <Text style={[styles.heroSubtitle, { color: mutedColor }]}>
              Complete medical logs for all your pregnancies & children
            </Text>
          </View>
        </View>

        {/* ── Summary Stats Badges ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statVal, { color: Colors.primary }]}>{pregnancies.length}</Text>
            <Text style={[styles.statLbl, { color: mutedColor }]}>Children</Text>
          </View>
          <View style={[styles.statBox, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statVal, { color: '#02848F' }]}>{summary.total_vitals || vitals.length}</Text>
            <Text style={[styles.statLbl, { color: mutedColor }]}>Vitals Logs</Text>
          </View>
          <View style={[styles.statBox, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statVal, { color: '#D97706' }]}>{summary.total_risk_assessments || riskAssessments.length}</Text>
            <Text style={[styles.statLbl, { color: mutedColor }]}>Assessments</Text>
          </View>
          <View style={[styles.statBox, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statVal, { color: '#8B5CF6' }]}>{summary.total_symptom_logs || symptomLogs.length}</Text>
            <Text style={[styles.statLbl, { color: mutedColor }]}>Symptoms</Text>
          </View>
        </View>
      </View>

      {/* ── Pregnancy / Child Filter Bar ── */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterTitle, { color: mutedColor }]}>FILTER BY CHILD / PREGNANCY:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              selectedPregId === 'all' && styles.filterPillActive,
              isDarkMode && selectedPregId !== 'all' && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
            ]}
            onPress={() => handleSelectFilter('all')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people-outline"
              size={14}
              color={selectedPregId === 'all' ? '#FFF' : (isDarkMode ? '#F0EEF0' : '#475569')}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedPregId === 'all' ? styles.filterPillTextActive : (isDarkMode && { color: '#F0EEF0' }),
              ]}
            >
              All Children / Pregnancies
            </Text>
          </TouchableOpacity>

          {pregnancies.map((p) => {
            const isSelected = selectedPregId === p.id;
            const isActivePreg = p.id === activePregId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                  isDarkMode && !isSelected && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
                ]}
                onPress={() => handleSelectFilter(p.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="happy-outline"
                  size={14}
                  color={isSelected ? '#FFF' : (isDarkMode ? '#F0EEF0' : '#475569')}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected ? styles.filterPillTextActive : (isDarkMode && { color: '#F0EEF0' }),
                  ]}
                >
                  {p.title || `Pregnancy #${p.pregnancy_number}`}
                  {isActivePreg ? ' (Active)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Segmented Navigation Tabs ── */}
      <View style={[styles.tabBar, isDarkMode && { backgroundColor: '#141416', borderColor: '#2C2C31' }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'children' && styles.tabBtnActive]}
          onPress={() => setActiveTab('children')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'children' ? Colors.primary : mutedColor}
          />
          <Text style={[styles.tabBtnText, activeTab === 'children' && styles.tabBtnTextActive]}>
            Children ({pregnancies.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'vitals' && styles.tabBtnActive]}
          onPress={() => setActiveTab('vitals')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="pulse"
            size={16}
            color={activeTab === 'vitals' ? Colors.primary : mutedColor}
          />
          <Text style={[styles.tabBtnText, activeTab === 'vitals' && styles.tabBtnTextActive]}>
            Vitals ({vitals.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'risk' && styles.tabBtnActive]}
          onPress={() => setActiveTab('risk')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={activeTab === 'risk' ? Colors.primary : mutedColor}
          />
          <Text style={[styles.tabBtnText, activeTab === 'risk' && styles.tabBtnTextActive]}>
            Risk ({riskAssessments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'symptoms' && styles.tabBtnActive]}
          onPress={() => setActiveTab('symptoms')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="medkit"
            size={16}
            color={activeTab === 'symptoms' ? Colors.primary : mutedColor}
          />
          <Text style={[styles.tabBtnText, activeTab === 'symptoms' && styles.tabBtnTextActive]}>
            Symptoms ({symptomLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: ALL CHILDREN / PREGNANCIES ── */}
      {activeTab === 'children' && (
        <View style={styles.sectionContainer}>
          {pregnancies.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
              <Ionicons name="heart-dislike-outline" size={42} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No Pregnancies on Record</Text>
              <Text style={[styles.emptySub, { color: mutedColor }]}>
                You haven't recorded any past or current pregnancies yet.
              </Text>
            </View>
          ) : (
            pregnancies.map((p, idx) => {
              const pSum = summaries[p.id] || {};
              const isActive = p.id === activePregId;
              const isCompleted = p.status === 'completed';
              return (
                <View key={p.id} style={[styles.childCard, { backgroundColor: cardBg, borderColor: border }, Shadows.card]}>
                  <View style={styles.childCardHeader}>
                    <View style={styles.childHeaderLeft}>
                      <View style={[styles.childNumberBadge, { backgroundColor: isDarkMode ? '#3A1820' : '#FFE4EC' }]}>
                        <Text style={styles.childNumberText}>#{p.pregnancy_number || pregnancies.length - idx}</Text>
                      </View>
                      <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.childTitle, { color: textColor }]}>
                          {p.title || `Pregnancy #${p.pregnancy_number}`}
                        </Text>
                        <Text style={[styles.childCreated, { color: mutedColor }]}>
                          Added {p.created_at ? p.created_at.split(' ')[0] : '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={[
                      styles.statusBadge,
                      isActive ? styles.statusBadgeActive : (isCompleted ? styles.statusBadgeCompleted : styles.statusBadgeArchived)
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        isActive ? styles.statusTextActive : (isCompleted ? styles.statusTextCompleted : styles.statusTextArchived)
                      ]}>
                        {isActive ? 'Active' : (isCompleted ? 'Delivered' : 'Archived')}
                      </Text>
                    </View>
                  </View>

                  {/* Dates Details */}
                  <View style={styles.childDetailsRow}>
                    {p.edd ? (
                      <View style={styles.childDetailItem}>
                        <Ionicons name="calendar-outline" size={14} color={mutedColor} />
                        <Text style={[styles.childDetailLabel, { color: mutedColor }]}>EDD: </Text>
                        <Text style={[styles.childDetailVal, { color: textColor }]}>{p.edd}</Text>
                      </View>
                    ) : null}
                    {p.delivery_date ? (
                      <View style={styles.childDetailItem}>
                        <Ionicons name="gift-outline" size={14} color="#02848F" />
                        <Text style={[styles.childDetailLabel, { color: mutedColor }]}>Delivered: </Text>
                        <Text style={[styles.childDetailVal, { color: textColor }]}>{p.delivery_date}</Text>
                      </View>
                    ) : null}
                  </View>

                  {p.notes ? (
                    <Text style={[styles.childNotes, isDarkMode && { color: '#B8B4BA', backgroundColor: '#141416' }]}>
                      "{p.notes}"
                    </Text>
                  ) : null}

                  {/* Counters Badges */}
                  <View style={styles.childCountsRow}>
                    <View style={[styles.childCountBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                      <Text style={[styles.childCountNum, { color: '#02848F' }]}>{pSum.vitals_count || 0}</Text>
                      <Text style={[styles.childCountLbl, { color: mutedColor }]}>Vitals</Text>
                    </View>
                    <View style={[styles.childCountBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                      <Text style={[styles.childCountNum, { color: '#D97706' }]}>{pSum.risk_count || 0}</Text>
                      <Text style={[styles.childCountLbl, { color: mutedColor }]}>Risks</Text>
                    </View>
                    <View style={[styles.childCountBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                      <Text style={[styles.childCountNum, { color: '#8B5CF6' }]}>{pSum.symptoms_count || 0}</Text>
                      <Text style={[styles.childCountLbl, { color: mutedColor }]}>Symptoms</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.childActionsRow}>
                    <TouchableOpacity
                      style={[styles.childActionBtn, { backgroundColor: Colors.primary }]}
                      onPress={() => {
                        handleSelectFilter(p.id);
                        setActiveTab('vitals');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="eye-outline" size={14} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.childActionBtnText}>View Records</Text>
                    </TouchableOpacity>

                    {!isActive && (
                      <TouchableOpacity
                        style={[styles.childActionBtnOutline, { borderColor: border }]}
                        onPress={() => handleSwitchActive(p.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.childActionBtnOutlineText, { color: Colors.primary }]}>
                          Set as Active
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ── TAB 2: VITALS & TRENDS HISTORY ── */}
      {activeTab === 'vitals' && (
        <View style={styles.sectionContainer}>
          {/* Trend Analysis Card */}
          <View style={[styles.trendsCard, { backgroundColor: cardBg, borderColor: border }, Shadows.card]}>
            <View style={styles.trendsHeader}>
              <View>
                <Text style={[styles.trendsTitle, { color: textColor }]}>Vitals Trend Analysis</Text>
                <Text style={[styles.trendsSub, { color: mutedColor }]}>
                  {selectedPregId === 'all' ? 'All Children / Pregnancies' : 'Filtered to selected child'}
                </Text>
              </View>

              {/* Metric Toggle: BP vs Weight */}
              <View style={styles.metricToggleRow}>
                <TouchableOpacity
                  style={[styles.metricToggleBtn, trendMetric === 'bp' && styles.metricToggleBtnActive]}
                  onPress={() => setTrendMetric('bp')}
                >
                  <Text style={[styles.metricToggleText, trendMetric === 'bp' && styles.metricToggleTextActive]}>BP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.metricToggleBtn, trendMetric === 'weight' && styles.metricToggleBtnActive]}
                  onPress={() => setTrendMetric('weight')}
                >
                  <Text style={[styles.metricToggleText, trendMetric === 'weight' && styles.metricToggleTextActive]}>Weight</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Timeframe Toggle: Daily | Weekly | Monthly */}
            <View style={styles.timeframeRow}>
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.timeframeBtn,
                    trendTimeframe === tf && styles.timeframeBtnActive,
                    isDarkMode && trendTimeframe !== tf && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                  ]}
                  onPress={() => setTrendTimeframe(tf)}
                >
                  <Text
                    style={[
                      styles.timeframeText,
                      trendTimeframe === tf && styles.timeframeTextActive,
                      isDarkMode && trendTimeframe !== tf && { color: '#85818A' },
                    ]}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SVG Trend Graph */}
            <VitalsTrendChart
              items={trends?.[trendTimeframe] || []}
              metric={trendMetric}
              isDarkMode={isDarkMode}
            />

            {/* Legend & Stats */}
            {trendMetric === 'bp' ? (
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#C2577D' }]} />
                  <Text style={[styles.legendText, { color: mutedColor }]}>Systolic (Top)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#02848F' }]} />
                  <Text style={[styles.legendText, { color: mutedColor }]}>Diastolic (Bottom)</Text>
                </View>
                {summary.avg_bp && (
                  <Text style={[styles.legendAvg, { color: textColor }]}>Avg: {summary.avg_bp}</Text>
                )}
              </View>
            ) : (
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#246944' }]} />
                  <Text style={[styles.legendText, { color: mutedColor }]}>Weight (kg)</Text>
                </View>
              </View>
            )}
          </View>

          {/* Vitals Log Entries List */}
          <Text style={[styles.subSectionTitle, { color: textColor }]}>
            All Logged Readings ({vitals.length})
          </Text>

          {vitals.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
              <Ionicons name="pulse-outline" size={42} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No Vitals Recorded</Text>
              <Text style={[styles.emptySub, { color: mutedColor }]}>
                No health readings have been logged yet for this selection.
              </Text>
            </View>
          ) : (
            vitals.map((log) => {
              const sys = Number(log.bp_sys);
              const dia = Number(log.bp_dia);
              const isHigh = sys >= 140 || dia >= 90;
              const isElevated = (sys >= 120 && sys < 140) || (dia >= 80 && dia < 90);

              return (
                <View key={log.id} style={[styles.logCard, { backgroundColor: cardBg, borderColor: border }, Shadows.card]}>
                  <View style={styles.logCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.logDate, { color: textColor }]}>
                        {log.date ? log.date.replace('T', ' ') : '—'}
                      </Text>
                      {log.pregnancy_title ? (
                        <Text style={[styles.logPregTitle, { color: Colors.primary }]}>
                          👶 {log.pregnancy_title}
                        </Text>
                      ) : null}
                    </View>

                    {sys && dia ? (
                      <View style={[
                        styles.bpTag,
                        isHigh ? styles.bpTagHigh : (isElevated ? styles.bpTagElevated : styles.bpTagNormal)
                      ]}>
                        <Text style={[
                          styles.bpTagText,
                          isHigh ? styles.bpTextHigh : (isElevated ? styles.bpTextElevated : styles.bpTextNormal)
                        ]}>
                          {sys}/{dia} mmHg
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Vitals Grid Chips */}
                  <View style={styles.vitalsChipGrid}>
                    {log.heart_rate ? (
                      <View style={[styles.vitalChip, isDarkMode && { backgroundColor: '#131316' }]}>
                        <Ionicons name="heart" size={13} color="#E11D48" />
                        <Text style={[styles.vitalChipVal, { color: textColor }]}>{log.heart_rate} bpm</Text>
                      </View>
                    ) : null}
                    {log.temperature ? (
                      <View style={[styles.vitalChip, isDarkMode && { backgroundColor: '#131316' }]}>
                        <Ionicons name="thermometer" size={13} color="#EA580C" />
                        <Text style={[styles.vitalChipVal, { color: textColor }]}>{log.temperature}°C</Text>
                      </View>
                    ) : null}
                    {log.blood_sugar ? (
                      <View style={[styles.vitalChip, isDarkMode && { backgroundColor: '#131316' }]}>
                        <Ionicons name="water" size={13} color="#02848F" />
                        <Text style={[styles.vitalChipVal, { color: textColor }]}>
                          {log.blood_sugar} mg/dL {log.sugar_time ? `(${log.sugar_time})` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {log.weight_kg ? (
                      <View style={[styles.vitalChip, isDarkMode && { backgroundColor: '#131316' }]}>
                        <Ionicons name="speedometer" size={13} color="#16A34A" />
                        <Text style={[styles.vitalChipVal, { color: textColor }]}>{log.weight_kg} kg</Text>
                      </View>
                    ) : null}
                    {log.fetal_movement !== null && log.fetal_movement !== undefined ? (
                      <View style={[styles.vitalChip, isDarkMode && { backgroundColor: '#131316' }]}>
                        <Ionicons name="footsteps" size={13} color="#C2577D" />
                        <Text style={[styles.vitalChipVal, { color: textColor }]}>{log.fetal_movement} kicks</Text>
                      </View>
                    ) : null}
                  </View>

                  {log.notes ? (
                    <Text style={[styles.logNotes, isDarkMode && { color: '#B8B4BA' }]}>
                      Notes: {log.notes}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ── TAB 3: RISK ASSESSMENTS HISTORY ── */}
      {activeTab === 'risk' && (
        <View style={styles.sectionContainer}>
          {/* Attended Doctor Consultations History */}
          {clinicalVisits.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.subSectionTitle, { color: textColor }]}>
                Attended Doctor Consultations ({clinicalVisits.length})
              </Text>
              {clinicalVisits.map((cv) => (
                <View key={cv.id} style={[styles.visitCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={styles.visitHeader}>
                    <View style={styles.visitIconWrap}>
                      <Ionicons name="medkit" size={16} color="#02848F" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.visitFacility, { color: textColor }]}>
                        {cv.facility || 'Hospital / OB-GYN Clinic'}
                      </Text>
                      <Text style={[styles.visitDoc, { color: mutedColor }]}>
                        {cv.doctor ? `Dr. ${cv.doctor}` : 'Medical Provider'} • {cv.visit_date}
                      </Text>
                    </View>
                    <View style={styles.visitedPill}>
                      <Text style={styles.visitedPillText}>Archived</Text>
                    </View>
                  </View>
                  {cv.notes ? (
                    <Text style={[styles.visitNotes, isDarkMode && { color: '#CBD5E1' }]}>
                      "{cv.notes}"
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.subSectionTitle, { color: textColor }]}>
            Coopland Risk Assessments ({riskAssessments.length})
          </Text>

          {riskAssessments.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
              <Ionicons name="shield-checkmark-outline" size={42} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No Risk Assessments</Text>
              <Text style={[styles.emptySub, { color: mutedColor }]}>
                No maternal risk assessments have been completed yet for this selection.
              </Text>
            </View>
          ) : (
            riskAssessments.map((ra) => {
              const lvl = (ra.risk_level || 'Low').toLowerCase();
              const isSevere = lvl.includes('severe');
              const isHigh = lvl.includes('high') || lvl.includes('mod');

              const badgeColor = isSevere ? '#DC2626' : (isHigh ? '#D97706' : '#15803D');
              const badgeBg = isSevere ? '#FEE2E2' : (isHigh ? '#FEF3C7' : '#DCFCE7');

              return (
                <View key={ra.id} style={[styles.riskCard, { backgroundColor: cardBg, borderColor: border }, Shadows.card]}>
                  <View style={styles.riskCardHeader}>
                    <View>
                      <Text style={[styles.riskDate, { color: textColor }]}>
                        {ra.date ? ra.date.replace('T', ' ') : '—'}
                      </Text>
                      {ra.pregnancy_title ? (
                        <Text style={[styles.riskPregTitle, { color: Colors.primary }]}>
                          👶 {ra.pregnancy_title}
                        </Text>
                      ) : null}
                    </View>

                    <View style={[styles.riskLevelBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.riskLevelBadgeText, { color: badgeColor }]}>
                        {ra.risk_level} Risk (Score: {ra.score})
                      </Text>
                    </View>
                  </View>

                  {ra.factors && ra.factors.length > 0 ? (
                    <View style={styles.factorsWrap}>
                      <Text style={[styles.factorsLabel, { color: mutedColor }]}>CONTRIBUTING FACTORS:</Text>
                      <View style={styles.factorsList}>
                        {ra.factors.map((f: string, fIdx: number) => (
                          <View key={fIdx} style={[styles.factorTag, isDarkMode && { backgroundColor: '#1E293B' }]}>
                            <Ionicons name="alert-circle" size={12} color={badgeColor} style={{ marginRight: 4 }} />
                            <Text style={[styles.factorTagText, { color: textColor }]}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ── TAB 4: SYMPTOMS CHECK-IN HISTORY ── */}
      {activeTab === 'symptoms' && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.subSectionTitle, { color: textColor }]}>
            Logged Symptoms History ({symptomLogs.length})
          </Text>

          {symptomLogs.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor: border }]}>
              <Ionicons name="medkit-outline" size={42} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No Symptoms Logged</Text>
              <Text style={[styles.emptySub, { color: mutedColor }]}>
                No symptom check-ins have been recorded yet for this selection.
              </Text>
            </View>
          ) : (
            symptomLogs.map((sl) => (
              <View key={sl.id} style={[styles.symptomCard, { backgroundColor: cardBg, borderColor: border }, Shadows.card]}>
                <View style={styles.symptomCardHeader}>
                  <View>
                    <Text style={[styles.symptomDate, { color: textColor }]}>
                      {sl.date ? sl.date.replace('T', ' ') : '—'}
                    </Text>
                    {sl.pregnancy_title ? (
                      <Text style={[styles.symptomPregTitle, { color: Colors.primary }]}>
                        👶 {sl.pregnancy_title}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.symptomCountPill}>
                    <Text style={styles.symptomCountPillText}>
                      {sl.items.length} {sl.items.length === 1 ? 'Symptom' : 'Symptoms'}
                    </Text>
                  </View>
                </View>

                {/* Items List */}
                <View style={styles.symptomItemsWrap}>
                  {sl.items.map((it: any, itIdx: number) => {
                    const sev = (it.severity || '').toLowerCase();
                    const isSevere = sev.includes('severe');
                    const isMod = sev.includes('mod');
                    const tagColor = isSevere ? '#DC2626' : (isMod ? '#D97706' : '#2563EB');
                    const tagBg = isSevere ? '#FEE2E2' : (isMod ? '#FEF3C7' : '#EFF6FF');

                    return (
                      <View key={itIdx} style={[styles.symptomRow, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.symptomName, { color: textColor }]}>{it.name || it.symptom_id}</Text>
                          {it.duration || it.frequency ? (
                            <Text style={[styles.symptomMeta, { color: mutedColor }]}>
                              {[it.duration, it.frequency].filter(Boolean).join(' • ')}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.sevBadge, { backgroundColor: tagBg }]}>
                          <Text style={[styles.sevBadgeText, { color: tagColor }]}>{it.severity}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Special Conditions */}
                {sl.conditions && sl.conditions.length > 0 ? (
                  <View style={styles.conditionsWrap}>
                    <Text style={[styles.conditionsTitle, { color: mutedColor }]}>CONDITIONS IDENTIFIED:</Text>
                    <View style={styles.conditionsList}>
                      {sl.conditions.map((c: string, cIdx: number) => (
                        <View key={cIdx} style={[styles.conditionPill, isDarkMode && { backgroundColor: '#1E293B' }]}>
                          <Text style={[styles.conditionPillText, { color: textColor }]}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  filterSection: {
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: '#FFE4EC',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  sectionContainer: {
    gap: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginVertical: 4,
  },
  emptyBox: {
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  // Child Cards
  childCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  childCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  childHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  childNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  childTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  childCreated: {
    fontSize: 11,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeCompleted: {
    backgroundColor: '#E0F2FE',
  },
  statusBadgeArchived: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803D',
  },
  statusTextCompleted: {
    color: '#0369A1',
  },
  statusTextArchived: {
    color: '#64748B',
  },
  childDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  childDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  childDetailLabel: {
    fontSize: 12,
  },
  childDetailVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  childNotes: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  childCountsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  childCountBadge: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  childCountNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  childCountLbl: {
    fontSize: 10,
    fontWeight: '600',
  },
  childActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  childActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  childActionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  childActionBtnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childActionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Trends Card
  trendsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  trendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trendsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  trendsSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  metricToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  metricToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  metricToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  metricToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  metricToggleTextActive: {
    color: '#FFFFFF',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  timeframeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeframeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeframeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  timeframeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  trendTooltipBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trendTooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trendTooltipDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  trendTooltipHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  trendTooltipValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendValuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trendValueLabel: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  trendValueNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  trendStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trendEmptyBox: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  trendEmptyText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  legendAvg: {
    marginLeft: 'auto',
    fontSize: 11.5,
    fontWeight: '700',
  },
  // Vitals Log Cards
  logCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  logPregTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  bpTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bpTagNormal: {
    backgroundColor: '#DCFCE7',
  },
  bpTagElevated: {
    backgroundColor: '#FEF3C7',
  },
  bpTagHigh: {
    backgroundColor: '#FEE2E2',
  },
  bpTagText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  bpTextNormal: {
    color: '#15803D',
  },
  bpTextElevated: {
    color: '#D97706',
  },
  bpTextHigh: {
    color: '#DC2626',
  },
  vitalsChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  vitalChipVal: {
    fontSize: 11,
    fontWeight: '600',
  },
  logNotes: {
    fontSize: 11.5,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Risk Cards
  riskCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  riskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  riskPregTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  riskLevelBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riskLevelBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  factorsWrap: {
    marginTop: 10,
  },
  factorsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  factorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  factorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  factorTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  visitCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitFacility: {
    fontSize: 13,
    fontWeight: '700',
  },
  visitDoc: {
    fontSize: 11,
  },
  visitedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  visitedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  visitNotes: {
    fontSize: 11.5,
    fontStyle: 'italic',
    marginTop: 6,
  },
  // Symptoms Cards
  symptomCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  symptomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  symptomDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  symptomPregTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  symptomCountPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  symptomCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  symptomItemsWrap: {
    gap: 6,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  symptomName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  symptomMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  sevBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sevBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  conditionsWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  conditionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  conditionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  conditionPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  conditionPillText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
