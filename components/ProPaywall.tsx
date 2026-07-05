import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { appAlert } from '../utils/appAlert';
import { PREMIUM_DRILL_COUNT } from '../data/vaultDrills';
import { STEP_SET_LIMIT } from '../hooks/useStepSets';
import { useVaultAccess, VaultPlan } from '../hooks/useVaultAccess';
import { palette, radii, shadows, sora, spacing } from '../constants/theme';

const amberBorder = 'rgba(255, 201, 77, 0.38)';

interface ProPaywallProps {
  visible: boolean;
  onClose: () => void;
  /** Shared vault-access instance owned by BadmintonCourt. */
  vault: ReturnType<typeof useVaultAccess>;
  /** Fires after a successful purchase or restore (previews get committed). */
  onSubscribed?: () => void;
}

/**
 * The one Pro paywall: a single subscription (RevenueCat `pro` entitlement)
 * unlocks the Drill Vault and every Pro customization style.
 */
export function ProPaywall({ visible, onClose, vault, onSubscribed }: ProPaywallProps) {
  const { plans, subscribe, restore } = vault;
  const [selectedPlan, setSelectedPlan] = useState<VaultPlan>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handleSubscribe = async () => {
    setIsPurchasing(true);
    try {
      const active = await subscribe(selectedPlan);
      if (active) {
        onSubscribed?.();
        onClose();
        appAlert(
          'Welcome to Featherwork Pro',
          'Every premium drill and every Pro style is unlocked.'
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
          ? 'Featherwork Pro is active on this device.'
          : 'No previous Pro purchase was found for this Google account.'
      );
      if (active) {
        onSubscribed?.();
        onClose();
      }
    } catch (error) {
      appAlert('Restore failed', 'Could not reach Google Play. Please try again later.');
      console.error(error);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.paywallHeader}>
              <View style={styles.paywallBadge}>
                <MaterialCommunityIcons name="crown" size={26} color={palette.accent} />
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel="Close paywall"
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={18} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.paywallTitle}>Featherwork Pro</Text>
            <Text style={styles.paywallPromise}>
              Every premium drill and every Pro style — mascots, court themes and shuttle
              trails — on one subscription.
            </Text>

            {[
              `${PREMIUM_DRILL_COUNT} premium drills & tactical patterns, new ones monthly`,
              '6 action-pose mascots with hero capes',
              '6 court themes & 4 shuttle styles',
              `Unlimited saved drills (free keeps ${STEP_SET_LIMIT})`,
            ].map((line) => (
              <View key={line} style={styles.bulletRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={palette.accent} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}

            <Text style={styles.comingSoonLabel}>Coming soon to Pro</Text>
            {[
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
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
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
  actionDisabled: {
    opacity: 0.45,
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
});
