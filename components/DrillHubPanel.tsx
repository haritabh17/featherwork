import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, ScrollView, Share, Text, TouchableOpacity } from 'react-native';
import { Portal, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { appAlert } from '../utils/appAlert';
import { StepSet } from '../types/drill';
import { decodeSharedStepSet, getShareMessage } from '../utils/stepSharing';
import {
  PREMIUM_DRILL_COUNT,
  VAULT_CATEGORIES,
  VAULT_DRILLS,
  VaultCategory,
  VaultDrill,
} from '../data/vaultDrills';
import { STEP_SET_LIMIT } from '../hooks/useStepSets';
import { useVaultAccess, VaultPlan } from '../hooks/useVaultAccess';
import { palette, radii, shadows, sora, spacing } from '../constants/theme';

export type DrillHubTab = 'mine' | 'vault';

const amberBorder = 'rgba(255, 201, 77, 0.38)';

interface DrillHubPanelProps {
  isVisible: boolean;
  initialTab: DrillHubTab;
  onClose: () => void;
  /** Single vault-access instance owned by BadmintonCourt so import gating shares it. */
  vault: ReturnType<typeof useVaultAccess>;
  stepSets: StepSet[];
  currentStepCount: number;
  /** Resolves false when the save was rejected (e.g. free-tier cap). */
  onSave: (name: string) => Promise<boolean>;
  onLoadStepSet: (stepSet: StepSet) => void;
  onDeleteStepSet: (id: string) => Promise<void>;
  onImport: (stepSet: StepSet) => Promise<void>;
  onLoadDrill: (drill: VaultDrill) => void;
}

interface ListActionProps {
  icon: string;
  variant?: 'primary' | 'glass' | 'danger';
  onPress: () => void;
}

function ListAction({ icon, variant = 'glass', onPress }: ListActionProps) {
  const color =
    variant === 'primary'
      ? palette.onAccent
      : variant === 'danger'
        ? palette.danger
        : palette.textPrimary;
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.listAction,
        variant === 'primary' && styles.listActionPrimary,
        variant === 'danger' && styles.listActionDanger,
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={17} color={color} />
    </TouchableOpacity>
  );
}

export function DrillHubPanel({
  isVisible,
  initialTab,
  onClose,
  vault,
  stepSets,
  currentStepCount,
  onSave,
  onLoadStepSet,
  onDeleteStepSet,
  onImport,
  onLoadDrill,
}: DrillHubPanelProps) {
  const { isSubscribed, plans, subscribe, restore, manageSubscription } = vault;
  const [activeTab, setActiveTab] = useState<DrillHubTab>(initialTab);
  const [activeCategory, setActiveCategory] = useState<VaultCategory | 'All'>('All');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<VaultPlan>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [stepSetName, setStepSetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isVisible) setActiveTab(initialTab);
  }, [isVisible, initialTab]);

  const drills =
    activeCategory === 'All'
      ? VAULT_DRILLS
      : VAULT_DRILLS.filter((drill) => drill.category === activeCategory);

  const canSave = currentStepCount >= 1;

  const handleDrillPress = (drill: VaultDrill) => {
    if (drill.premium && !isSubscribed) {
      setPaywallVisible(true);
      return;
    }
    onLoadDrill(drill);
    onClose();
  };

  const handleSubscribe = async () => {
    setIsPurchasing(true);
    try {
      const active = await subscribe(selectedPlan);
      if (active) {
        setPaywallVisible(false);
        appAlert(
          'Welcome to Drill Vault Pro',
          'All premium drills are unlocked. Load any drill and step through it on court.'
        );
      }
      // false = user backed out of the Play sheet; nothing to say.
    } catch (error) {
      appAlert(
        'Purchase failed',
        error instanceof Error ? error.message : 'Could not complete the purchase. Please try again.'
      );
      console.error(error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      const active = await restore();
      appAlert(
        active ? 'Purchases restored' : 'Nothing to restore',
        active
          ? 'Drill Vault Pro is active on this device.'
          : 'No previous Drill Vault Pro purchase was found for this Google account.'
      );
      if (active) setPaywallVisible(false);
    } catch (error) {
      appAlert('Restore failed', 'Could not reach Google Play. Please try again later.');
      console.error(error);
    }
  };

  const handleSave = async () => {
    const trimmedName = stepSetName.trim();
    if (!trimmedName) {
      appAlert('Name required', 'Please enter a name for this drill.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onSave(trimmedName);
      setSaveDialogVisible(false);
      if (saved) {
        setStepSetName('');
        appAlert('Saved', `"${trimmedName}" has been saved.`);
      }
    } catch (error) {
      appAlert('Save failed', 'Could not save this drill.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async (stepSet: StepSet) => {
    try {
      await Share.share({
        message: getShareMessage(stepSet),
        title: `Share ${stepSet.name}`,
      });
    } catch (error) {
      appAlert('Share failed', 'Could not open the share sheet.');
      console.error(error);
    }
  };

  const handleDelete = (stepSet: StepSet) => {
    appAlert('Delete drill', `Delete "${stepSet.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDeleteStepSet(stepSet.id);
          } catch (error) {
            appAlert('Delete failed', 'Could not delete this drill.');
            console.error(error);
          }
        },
      },
    ]);
  };

  const handleImportFromClipboard = async () => {
    setIsImporting(true);
    try {
      const clipboardText = await Clipboard.getStringAsync();
      const imported = decodeSharedStepSet(clipboardText);

      if (!imported) {
        appAlert('Import failed', 'Clipboard does not contain a valid badminton drill link.');
        return;
      }

      await onImport(imported);
      onClose();
    } catch (error) {
      appAlert('Import failed', 'Could not import from clipboard.');
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.grabHandle} />
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Drills</Text>
                <Text style={styles.headerSubtitle}>
                  {activeTab === 'mine'
                    ? `Current sequence · ${currentStepCount} step${currentStepCount === 1 ? '' : 's'}`
                    : 'Tactical patterns ready to load onto the court'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={18} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
                onPress={() => setActiveTab('mine')}
              >
                <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
                  My Drills
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'vault' && styles.tabActive]}
                onPress={() => setActiveTab('vault')}
              >
                <MaterialCommunityIcons
                  name="treasure-chest"
                  size={15}
                  color={activeTab === 'vault' ? palette.onAccent : palette.accent}
                />
                <Text style={[styles.tabText, activeTab === 'vault' && styles.tabTextActive]}>
                  Drill Vault
                </Text>
                <View style={[styles.proPill, activeTab === 'vault' && styles.proPillOnAccent]}>
                  <Text
                    style={[styles.proPillText, activeTab === 'vault' && styles.proPillTextOnAccent]}
                  >
                    PRO
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {activeTab === 'mine' ? (
              <>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.primaryAction, !canSave && styles.actionDisabled]}
                    onPress={() => {
                      if (!isSubscribed && stepSets.length >= STEP_SET_LIMIT) {
                        setPaywallVisible(true);
                        return;
                      }
                      setSaveDialogVisible(true);
                    }}
                    disabled={!canSave}
                  >
                    <MaterialCommunityIcons name="tray-arrow-down" size={18} color={palette.onAccent} />
                    <Text style={styles.primaryActionText}>Save current steps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryAction, isImporting && styles.actionDisabled]}
                    onPress={handleImportFromClipboard}
                    disabled={isImporting}
                  >
                    <MaterialCommunityIcons
                      name="clipboard-arrow-down-outline"
                      size={18}
                      color={palette.textPrimary}
                    />
                    <Text style={styles.secondaryActionText}>
                      {isImporting ? 'Importing…' : 'Import from clipboard'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.listLabel}>
                  Saved drills
                  {!isSubscribed &&
                    ` · ${Math.min(stepSets.length, STEP_SET_LIMIT)}/${STEP_SET_LIMIT} free`}
                </Text>

                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  {stepSets.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No saved drills yet — build steps and save them here, or load one from the
                      Drill Vault.
                    </Text>
                  ) : (
                    stepSets.map((stepSet) => (
                      <View key={stepSet.id} style={styles.listItem}>
                        <View style={styles.listItemInfo}>
                          <Text style={styles.listItemTitle} numberOfLines={1}>
                            {stepSet.name}
                          </Text>
                          <Text style={styles.listItemMeta}>
                            {stepSet.steps.length} steps · {stepSet.isDoubles ? 'Doubles' : 'Singles'}
                          </Text>
                        </View>
                        <View style={styles.itemActions}>
                          <ListAction
                            icon="play"
                            variant="primary"
                            onPress={() => {
                              onLoadStepSet(stepSet);
                              onClose();
                            }}
                          />
                          <ListAction icon="share-variant" onPress={() => handleShare(stepSet)} />
                          <ListAction
                            icon="trash-can-outline"
                            variant="danger"
                            onPress={() => handleDelete(stepSet)}
                          />
                        </View>
                      </View>
                    ))
                  )}

                  <TouchableOpacity style={styles.vaultUpsell} onPress={() => setActiveTab('vault')}>
                    <MaterialCommunityIcons name="treasure-chest" size={18} color={palette.accent} />
                    <View style={styles.bannerInfo}>
                      <Text style={styles.vaultUpsellTitle}>
                        {isSubscribed ? 'Browse the Drill Vault' : 'Explore the Drill Vault'}
                      </Text>
                      <Text style={styles.vaultUpsellMeta}>
                        {isSubscribed
                          ? 'Your premium drills and tactical patterns'
                          : `${VAULT_DRILLS.length} tactical patterns · new drills monthly · unlimited saves`}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={palette.accent} />
                  </TouchableOpacity>
                </ScrollView>
              </>
            ) : (
              <>
                {!isSubscribed ? (
                  <TouchableOpacity
                    style={styles.unlockBanner}
                    onPress={() => setPaywallVisible(true)}
                  >
                    <View style={styles.unlockBannerIcon}>
                      <MaterialCommunityIcons
                        name="treasure-chest"
                        size={22}
                        color={palette.accent}
                      />
                    </View>
                    <View style={styles.bannerInfo}>
                      <Text style={styles.unlockBannerTitle}>Unlock Drill Vault Pro</Text>
                      <Text style={styles.unlockBannerMeta}>
                        Full vault + new drills monthly · from $4.99/mo
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={palette.accent} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.unlockBanner} onPress={manageSubscription}>
                    <View style={styles.unlockBannerIcon}>
                      <MaterialCommunityIcons name="crown" size={22} color={palette.accent} />
                    </View>
                    <View style={styles.bannerInfo}>
                      <Text style={styles.unlockBannerTitle}>Drill Vault Pro is active</Text>
                      <Text style={styles.unlockBannerMeta}>
                        All drills unlocked · manage in Google Play
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="open-in-new" size={18} color={palette.accent} />
                  </TouchableOpacity>
                )}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                  contentContainerStyle={styles.chipRowContent}
                >
                  {(['All', ...VAULT_CATEGORIES] as const).map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.chip, activeCategory === category && styles.chipActive]}
                      onPress={() => setActiveCategory(category)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          activeCategory === category && styles.chipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                  {drills.map((drill) => {
                    const locked = drill.premium && !isSubscribed;
                    return (
                      <TouchableOpacity
                        key={drill.id}
                        style={styles.card}
                        onPress={() => handleDrillPress(drill)}
                      >
                        <View style={styles.cardInfo}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {drill.name}
                            </Text>
                            {!drill.premium && (
                              <View style={styles.freeTag}>
                                <Text style={styles.freeTagText}>FREE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.cardMeta}>
                            {drill.category} · {drill.difficulty} ·{' '}
                            {drill.isDoubles ? 'Doubles' : 'Singles'} · {drill.steps.length} steps
                          </Text>
                          <Text style={styles.cardDescription}>{drill.description}</Text>
                          {!locked && (
                            <View style={styles.tipRow}>
                              <MaterialCommunityIcons
                                name="lightbulb-on-outline"
                                size={13}
                                color={palette.accent}
                              />
                              <Text style={styles.tipText}>{drill.tip}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.cardAction, locked && styles.cardActionLocked]}>
                          <MaterialCommunityIcons
                            name={locked ? 'lock' : 'play'}
                            size={18}
                            color={locked ? palette.textMuted : palette.onAccent}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Portal>
        <Modal
          visible={paywallVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPaywallVisible(false)}
        >
          <View style={styles.dialogOverlay}>
            <View style={styles.dialogCard}>
              <View style={styles.paywallHeader}>
                <View style={styles.paywallBadge}>
                  <MaterialCommunityIcons name="treasure-chest" size={26} color={palette.accent} />
                </View>
                <TouchableOpacity
                  onPress={() => setPaywallVisible(false)}
                  hitSlop={8}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={18} color={palette.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paywallTitle}>Drill Vault Pro</Text>
              <Text style={styles.paywallPromise}>
                Unlock premium badminton drills and tactical patterns, updated regularly, ready to
                load directly onto the court.
              </Text>

              {[
                `${PREMIUM_DRILL_COUNT} premium drills & tactical patterns`,
                'New drills added every month',
                "Coach's tips on every drill",
                `Unlimited saved drills (free keeps ${STEP_SET_LIMIT})`,
              ].map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={palette.accent} />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}

              <Text style={styles.comingSoonLabel}>Coming soon to Pro</Text>
              {[
                { icon: 'play-speed', text: 'Auto-play practice mode for courtside training' },
                { icon: 'account-group-outline', text: 'Club workspace: team libraries & session plans' },
              ].map(({ icon, text }) => (
                <View key={text} style={styles.bulletRow}>
                  <MaterialCommunityIcons name={icon as any} size={16} color={palette.textMuted} />
                  <Text style={styles.comingSoonText}>{text}</Text>
                </View>
              ))}

              <View style={styles.planRow}>
                {plans.map((plan) => {
                  const selected = selectedPlan === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.planCard, selected && styles.planCardSelected]}
                      onPress={() => setSelectedPlan(plan.id)}
                    >
                      {plan.note && (
                        <View style={styles.planNote}>
                          <Text style={styles.planNoteText}>{plan.note}</Text>
                        </View>
                      )}
                      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>
                        {plan.label}
                      </Text>
                      <Text style={styles.planPrice}>{plan.price}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.subscribeButton, isPurchasing && styles.actionDisabled]}
                onPress={handleSubscribe}
                disabled={isPurchasing}
              >
                <Text style={styles.subscribeButtonText}>
                  {isPurchasing ? 'Processing…' : 'Subscribe'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRestore} hitSlop={6}>
                <Text style={styles.restoreLink}>Restore purchases</Text>
              </TouchableOpacity>
              <Text style={styles.finePrint}>
                Billed through Google Play as an auto-renewing subscription. Cancel anytime in
                Play Store → Payments &amp; subscriptions.
              </Text>
            </View>
          </View>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={saveDialogVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSaveDialogVisible(false)}
        >
          <View style={styles.dialogOverlay}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Save drill</Text>
              <TextInput
                label="Name"
                value={stepSetName}
                onChangeText={setStepSetName}
                mode="outlined"
                style={styles.nameInput}
                autoFocus
              />
              <View style={styles.dialogActions}>
                <TouchableOpacity
                  style={styles.dialogCancel}
                  onPress={() => setSaveDialogVisible(false)}
                >
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryAction, isSaving && styles.actionDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={styles.primaryActionText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.overlay,
  },
  sheet: {
    height: '86%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingBottom: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.55,
    shadowRadius: 25,
    elevation: 16,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...sora('600'),
    fontSize: 19,
    color: palette.textPrimary,
  },
  headerSubtitle: {
    ...sora('400'),
    fontSize: 11.5,
    color: palette.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingVertical: 9,
  },
  tabActive: {
    backgroundColor: palette.accent,
  },
  tabText: {
    ...sora('600'),
    color: palette.textSecondary,
    fontSize: 13,
  },
  tabTextActive: {
    color: palette.onAccent,
  },
  proPill: {
    backgroundColor: palette.accentSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: amberBorder,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  proPillOnAccent: {
    backgroundColor: 'rgba(35, 22, 4, 0.30)',
    borderColor: 'transparent',
  },
  proPillText: {
    ...sora('700'),
    color: palette.accent,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  proPillTextOnAccent: {
    color: palette.onAccent,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    backgroundColor: palette.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    ...shadows.amberGlow,
  },
  primaryActionText: {
    ...sora('700'),
    color: palette.onAccent,
    fontSize: 14,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
  },
  secondaryActionText: {
    ...sora('600'),
    color: palette.textPrimary,
    fontSize: 14,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  listLabel: {
    ...sora('700'),
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  listContent: {
    gap: 6,
    paddingBottom: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  listItemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  listItemTitle: {
    ...sora('600'),
    color: palette.textPrimary,
    fontSize: 14,
  },
  listItemMeta: {
    ...sora('400'),
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11.5,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listActionPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  listActionDanger: {
    backgroundColor: palette.dangerSoft,
    borderColor: palette.dangerBorder,
  },
  emptyText: {
    ...sora('400'),
    color: palette.textSecondary,
    fontSize: 12.5,
    paddingVertical: spacing.md,
  },
  vaultUpsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: amberBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  vaultUpsellTitle: {
    ...sora('600'),
    color: palette.textPrimary,
    fontSize: 13,
  },
  vaultUpsellMeta: {
    ...sora('400'),
    color: palette.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  bannerInfo: {
    flex: 1,
  },
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: amberBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  unlockBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 201, 77, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBannerTitle: {
    ...sora('600'),
    color: palette.textPrimary,
    fontSize: 14,
  },
  unlockBannerMeta: {
    ...sora('400'),
    color: palette.textSecondary,
    fontSize: 11.5,
    marginTop: 1,
  },
  chipRow: {
    marginTop: spacing.md,
    height: 38,
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRowContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  chipText: {
    ...sora('600'),
    color: palette.textSecondary,
    fontSize: 12,
  },
  chipTextActive: {
    color: palette.onAccent,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...sora('600'),
    color: palette.textPrimary,
    fontSize: 14,
    flexShrink: 1,
  },
  freeTag: {
    backgroundColor: palette.accentSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: amberBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  freeTagText: {
    ...sora('700'),
    color: palette.accent,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  cardMeta: {
    ...sora('400'),
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  cardDescription: {
    ...sora('400'),
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tipText: {
    ...sora('400'),
    flex: 1,
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  cardAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.accent,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: palette.overlayStrong,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialogCard: {
    width: '100%',
    backgroundColor: palette.dialog,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.dialogBorder,
    padding: spacing.xl,
    ...shadows.floating,
  },
  paywallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paywallBadge: {
    width: 46,
    height: 46,
    borderRadius: radii.sm,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: amberBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallTitle: {
    ...sora('700'),
    fontSize: 19,
    color: palette.textPrimary,
    marginTop: spacing.lg,
  },
  paywallPromise: {
    ...sora('400'),
    color: palette.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulletText: {
    ...sora('400'),
    color: palette.textPrimary,
    fontSize: 12.5,
  },
  comingSoonLabel: {
    ...sora('700'),
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  comingSoonText: {
    ...sora('400'),
    color: palette.textMuted,
    fontSize: 12,
  },
  planRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  planCard: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  planCardSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  planNote: {
    position: 'absolute',
    top: -9,
    backgroundColor: palette.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  planNoteText: {
    ...sora('700'),
    color: palette.onAccent,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  planLabel: {
    ...sora('600'),
    color: palette.textSecondary,
    fontSize: 12,
  },
  planLabelSelected: {
    color: palette.accent,
  },
  planPrice: {
    ...sora('700'),
    color: palette.textPrimary,
    fontSize: 16,
    marginTop: 2,
  },
  subscribeButton: {
    height: 50,
    backgroundColor: palette.accent,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    ...shadows.amberGlow,
  },
  subscribeButtonText: {
    ...sora('700'),
    color: palette.onAccent,
    fontSize: 15,
  },
  restoreLink: {
    ...sora('600'),
    color: palette.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  finePrint: {
    ...sora('400'),
    color: palette.textMuted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  nameInput: {
    marginTop: spacing.md,
    backgroundColor: palette.surfaceSunken,
  },
  dialogTitle: {
    ...sora('600'),
    fontSize: 16.5,
    color: palette.textPrimary,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  dialogCancel: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  dialogCancelText: {
    ...sora('600'),
    color: palette.textSecondary,
    fontSize: 14,
  },
});
