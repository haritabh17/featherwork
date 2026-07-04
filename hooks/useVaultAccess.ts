import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import Purchases, {
  CustomerInfo,
  PACKAGE_TYPE,
  PurchasesPackage,
} from 'react-native-purchases';

// Public client key — safe to ship in the APK by design.
const REVENUECAT_ANDROID_API_KEY = 'goog_VNkzBFJVPdILDIMuCwSBeKYexsx';
const PRO_ENTITLEMENT = 'pro';
const MANAGE_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?sku=drill_vault_pro&package=com.haritabhgupta.badmintoncourtsimulator';

export type VaultPlan = 'monthly' | 'yearly';

export interface VaultPlanOption {
  id: VaultPlan;
  label: string;
  price: string;
  note?: string;
}

// Shown until live Play prices load (offline, or an emulator without Play).
const FALLBACK_PLANS: VaultPlanOption[] = [
  { id: 'monthly', label: 'Monthly', price: '$4.99/mo' },
  { id: 'yearly', label: 'Yearly', price: '$39.99/yr', note: 'Save 33%' },
];

function hasPro(info: CustomerInfo | null): boolean {
  return Boolean(info?.entitlements.active[PRO_ENTITLEMENT]);
}

export function useVaultAccess() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<Partial<Record<VaultPlan, PurchasesPackage>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const onCustomerInfo = (info: CustomerInfo) => {
      if (isMounted) setCustomerInfo(info);
    };

    (async () => {
      try {
        if (!(await Purchases.isConfigured())) {
          Purchases.configure({ apiKey: REVENUECAT_ANDROID_API_KEY });
        }
        Purchases.addCustomerInfoUpdateListener(onCustomerInfo);

        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (!isMounted) return;

        setCustomerInfo(info);
        const byPlan: Partial<Record<VaultPlan, PurchasesPackage>> = {};
        for (const pkg of offerings.current?.availablePackages ?? []) {
          if (pkg.packageType === PACKAGE_TYPE.MONTHLY) byPlan.monthly = pkg;
          if (pkg.packageType === PACKAGE_TYPE.ANNUAL) byPlan.yearly = pkg;
        }
        setPackages(byPlan);
      } catch (error) {
        // Billing unreachable (offline / no Play services): stay free-tier,
        // paywall shows fallback prices, purchases error out politely.
        console.warn('RevenueCat unavailable:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfo);
    };
  }, []);

  const plans: VaultPlanOption[] = FALLBACK_PLANS.map((plan) => {
    const priceString = packages[plan.id]?.product.priceString;
    if (!priceString) return plan;
    return { ...plan, price: `${priceString}/${plan.id === 'monthly' ? 'mo' : 'yr'}` };
  });

  /** Resolves true when Pro is active afterwards, false when the user backed out. */
  const subscribe = useCallback(
    async (plan: VaultPlan) => {
      const pkg = packages[plan];
      if (!pkg) {
        throw new Error('Plans are unavailable right now. Check your connection and try again.');
      }
      try {
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        return hasPro(info);
      } catch (error) {
        if ((error as { userCancelled?: boolean })?.userCancelled) return false;
        throw error;
      }
    },
    [packages]
  );

  /** Resolves true when a previous Pro purchase was found for this account. */
  const restore = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
    return hasPro(info);
  }, []);

  // Google owns subscription cancellation; send the user to Play.
  const manageSubscription = useCallback(() => {
    Linking.openURL(customerInfo?.managementURL ?? MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
  }, [customerInfo]);

  return {
    isSubscribed: hasPro(customerInfo),
    isLoading,
    plans,
    subscribe,
    restore,
    manageSubscription,
  };
}
