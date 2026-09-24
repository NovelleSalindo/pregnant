import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date: string;
  is_read: number | boolean | string;
  kind?: string;
}

export const isNotificationUnread = (item?: { is_read?: any } | null): boolean => {
  if (!item) return false;
  return item.is_read !== 1 && item.is_read !== '1' && item.is_read !== true;
};

interface NotificationModalProps {
  visible: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll?: () => void;
  onDeleteNotification?: (id: string) => void;
  onItemPress?: (item: NotificationItem) => void;
  onMarkAsRead?: (id: string) => void;
  isDarkMode?: boolean;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  notifications,
  onClose,
  onMarkAllRead,
  onClearAll,
  onDeleteNotification,
  onItemPress,
  onMarkAsRead,
  isDarkMode = false,
}) => {
  const unreadCount = notifications.filter(isNotificationUnread).length;

  const getIconForKind = (kind?: string, title: string = '') => {
    if (kind === 'severe_risk_alert' || title.includes('Severe') || title.includes('🚨')) {
      return { name: 'alert-circle' as const, color: '#DC2626' };
    }
    if (kind === 'high_risk_alert' || title.includes('High') || title.includes('⚠️')) {
      return { name: 'warning' as const, color: '#D97706' };
    }
    if (kind === 'low_risk_assessment' || title.includes('Low')) {
      return { name: 'checkmark-circle' as const, color: '#16A34A' };
    }
    switch (kind) {
      case 'ob_visit':
        return { name: 'calendar' as const, color: Colors.primaryDark };
      case 'due_date':
        return { name: 'heart' as const, color: Colors.primary };
      case 'emergency':
        return { name: 'warning' as const, color: Colors.riskHigh };
      default:
        return { name: 'notifications' as const, color: Colors.secondaryDark };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            Shadows.large,
            isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, isDarkMode && { color: '#F0EEF0' }]}>Notifications</Text>
              <View style={[styles.countBadge, unreadCount > 0 && { backgroundColor: '#FCE7F3' }]}>
                <Text style={[styles.countText, unreadCount > 0 && { color: Colors.primaryDark }]}>
                  {unreadCount > 0 ? `${unreadCount} unread` : `${notifications.length}`}
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markReadBtn}
                  onPress={onMarkAllRead}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={13} color={Colors.secondaryDark} />
                  <Text style={styles.markReadText}>Mark All Read</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && onClearAll && (
                <TouchableOpacity
                  style={[
                    styles.clearAllBtn,
                    isDarkMode && { backgroundColor: '#38161D', borderColor: '#7F1D1D' },
                  ]}
                  onPress={onClearAll}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={13} color={Colors.riskHigh} />
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.closeBtn, isDarkMode && { backgroundColor: '#2C2C31' }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDarkMode ? '#F0EEF0' : Colors.textSoft} />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, isDarkMode && { color: '#F0EEF0' }]}>All Caught Up</Text>
                <Text style={[styles.emptyDesc, isDarkMode && { color: '#85818A' }]}>No new notifications right now.</Text>
              </View>
            ) : (
              notifications.map((item) => {
                const isUnread = isNotificationUnread(item);
                const isSevere = item.kind === 'severe_risk_alert' || item.title?.includes('Severe') || item.title?.includes('🚨');
                const isHigh = !isSevere && (item.kind === 'high_risk_alert' || item.title?.includes('High') || item.title?.includes('⚠️'));
                const icon = getIconForKind(item.kind, item.title);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      isDarkMode && { backgroundColor: '#131316', borderColor: '#26262D' },
                      // Unread styling:
                      isUnread && !isSevere && !isHigh && (
                        isDarkMode
                          ? { backgroundColor: '#211823', borderColor: '#FF94B8', borderLeftWidth: 4, borderLeftColor: '#FF94B8' }
                          : styles.itemUnread
                      ),
                      isUnread && isHigh && {
                        borderLeftWidth: 4,
                        borderLeftColor: '#D97706',
                        backgroundColor: isDarkMode ? '#2D200E' : '#FEF3C7',
                        borderColor: '#FCD34D',
                      },
                      isUnread && isSevere && {
                        borderLeftWidth: 4,
                        borderLeftColor: '#DC2626',
                        backgroundColor: isDarkMode ? '#331319' : '#FEE2E2',
                        borderColor: '#FCA5A5',
                      },
                      // Read styling:
                      !isUnread && isHigh && {
                        borderLeftWidth: 3,
                        borderLeftColor: '#F59E0B66',
                      },
                      !isUnread && isSevere && {
                        borderLeftWidth: 3,
                        borderLeftColor: '#EF444466',
                      },
                      !isUnread && (
                        isDarkMode
                          ? { backgroundColor: '#141418', borderColor: '#222228', opacity: 0.85 }
                          : { backgroundColor: '#FFFFFF', borderColor: '#ECE9EC', opacity: 0.88 }
                      ),
                    ]}
                    onPress={() => {
                      if (onItemPress) {
                        onItemPress(item);
                      } else if (onMarkAsRead) {
                        onMarkAsRead(item.id);
                      }
                    }}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: icon.color + '1A' }]}>
                      <Ionicons name={icon.name} size={18} color={icon.color} />
                    </View>

                    <View style={styles.itemBody}>
                      <View style={styles.itemHeader}>
                        <View style={styles.titleRow}>
                          {isUnread && <View style={styles.unreadDot} />}
                          <Text
                            style={[
                              styles.itemTitle,
                              isSevere && isUnread && { color: '#DC2626', fontWeight: '800' },
                              isHigh && isUnread && { color: '#B45309', fontWeight: '800' },
                              !isUnread && isDarkMode && { color: '#D4D0D8' },
                              isUnread && !isSevere && !isHigh && isDarkMode && { color: '#F0EEF0' },
                              isUnread && { fontWeight: '800' },
                            ]}
                            numberOfLines={2}
                          >
                            {item.title}
                          </Text>
                        </View>

                        <View style={styles.metaRight}>
                          {isUnread ? (
                            <View style={[styles.unreadBadge, isDarkMode && { backgroundColor: '#4A1D32', borderColor: '#831843' }]}>
                              <Text style={styles.unreadBadgeText}>NEW</Text>
                            </View>
                          ) : (
                            <View style={styles.readBadge}>
                              <Ionicons name="checkmark" size={10} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                              <Text style={[styles.readBadgeText, isDarkMode && { color: '#9CA3AF' }]}>Read</Text>
                            </View>
                          )}

                          <Text style={[styles.itemDate, isDarkMode && { color: '#85818A' }]}>
                            {item.date?.slice(5, 16) || ''}
                          </Text>

                          {onDeleteNotification && (
                            <TouchableOpacity
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={(e) => {
                                e.stopPropagation();
                                onDeleteNotification(item.id);
                              }}
                              style={styles.deleteItemBtn}
                              activeOpacity={0.6}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={14}
                                color={isDarkMode ? '#F87171' : Colors.riskHigh}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.itemText,
                          isSevere && isUnread && { color: isDarkMode ? '#FCA5A5' : '#991B1B' },
                          isHigh && isUnread && { color: isDarkMode ? '#FCD34D' : '#92400E' },
                          !isUnread && { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                          isUnread && !isSevere && !isHigh && isDarkMode && { color: '#B8B4BA' },
                        ]}
                      >
                        {item.body}
                      </Text>

                      {/* Card Footer with Quick Actions */}
                      <View style={styles.cardFooter}>
                        {isUnread ? (
                          <View style={styles.footerRow}>
                            <View style={styles.tapActionWrap}>
                              <Text style={[styles.tapActionText, isDarkMode && { color: '#FF94B8' }]}>
                                Tap message to open
                              </Text>
                              <Ionicons name="arrow-forward" size={11} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                            </View>

                            {onMarkAsRead && (
                              <TouchableOpacity
                                style={[
                                  styles.quickMarkReadBtn,
                                  isDarkMode && { backgroundColor: '#381A28', borderColor: '#831843' },
                                ]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  onMarkAsRead(item.id);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.65}
                              >
                                <Ionicons name="checkmark-done" size={11} color={Colors.primaryDark} />
                                <Text style={styles.quickMarkReadText}>Mark read</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <View style={styles.footerRow}>
                            <View style={styles.tapActionWrap}>
                              <Text style={[styles.tapActionTextMuted, isDarkMode && { color: '#7E7A85' }]}>
                                Tap to view details
                              </Text>
                              <Ionicons name="chevron-forward" size={12} color={isDarkMode ? '#7E7A85' : '#9CA3AF'} />
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '78%',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    fontFamily: 'serif',
  },
  countBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.secondarySoft,
  },
  markReadText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.secondaryDark,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearAllText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.riskHigh,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingVertical: 4,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  itemUnread: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryDark,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    flexWrap: 'wrap',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primaryDark,
    marginRight: 6,
  },
  unreadBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    marginRight: 4,
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.3,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    marginRight: 4,
  },
  readBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    lineHeight: 18,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deleteItemBtn: {
    padding: 2,
  },
  itemDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemText: {
    fontSize: 12.5,
    color: Colors.textSoft,
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tapActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  tapActionTextMuted: {
    fontSize: 10.5,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  quickMarkReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  quickMarkReadText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
