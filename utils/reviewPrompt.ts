import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { appAlert } from './appAlert';

const SAVE_COUNT_KEY = 'review-save-count';
const PROMPTED_KEY = 'review-prompted';
/** Ask only after this many saved drills — proven engagement, not a nag. */
const SAVES_BEFORE_PROMPT = 2;

const NEXT_ASK_KEY = 'review-next-ask-at';
const RATED_KEY = 'review-rated';
export const QUARTER_MS = 90 * 24 * 60 * 60 * 1000;
const MARKET_URL = 'market://details?id=com.haritabhgupta.badmintoncourtsimulator';
const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.haritabhgupta.badmintoncourtsimulator';

/**
 * Counts a successful drill save and, once the user has shown real
 * engagement, requests Play's native in-app review dialog — once ever.
 * Play additionally rate-limits and may skip the dialog; every failure is
 * swallowed so review plumbing can never affect the save flow.
 */
export async function recordSaveForReviewPrompt(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(PROMPTED_KEY)) return;

    const count = Number((await AsyncStorage.getItem(SAVE_COUNT_KEY)) ?? '0') + 1;
    await AsyncStorage.setItem(SAVE_COUNT_KEY, String(count));
    if (count < SAVES_BEFORE_PROMPT) return;

    // No Play services (e.g. bare emulator): skip now, retry on a later save.
    if (!(await StoreReview.hasAction())) return;

    // Mark before requesting so an interrupted dialog can never re-prompt.
    await AsyncStorage.setItem(PROMPTED_KEY, '1');
    await StoreReview.requestReview();
  } catch {
    // Never let review plumbing break a save.
  }
}

/**
 * Every 90 days, one light-hearted nudge toward the Play Store listing —
 * stops forever once the user taps through to rate. Uses our own dialog and
 * a store deep link (not the in-app review API, whose rules forbid asking
 * questions around its card, and which never reveals whether/what anyone
 * rated). Call once per app launch.
 */
export async function maybeAskQuarterlyReview(now: number = Date.now()): Promise<void> {
  try {
    if (await AsyncStorage.getItem(RATED_KEY)) return;

    const nextAskAt = await AsyncStorage.getItem(NEXT_ASK_KEY);
    if (!nextAskAt) {
      await AsyncStorage.setItem(NEXT_ASK_KEY, String(now + QUARTER_MS));
      return;
    }
    if (now < Number(nextAskAt)) return;

    // Re-arm before showing so an interrupted dialog waits a full quarter.
    await AsyncStorage.setItem(NEXT_ASK_KEY, String(now + QUARTER_MS));

    appAlert('A quick rally 🏸', 'Do you like Featherwork? Be honest — the shuttle can take it.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Love it — rate it ⭐',
        onPress: () => {
          AsyncStorage.setItem(RATED_KEY, '1').catch(() => {});
          Linking.openURL(MARKET_URL).catch(() =>
            Linking.openURL(PLAY_URL).catch(() => {})
          );
        },
      },
    ]);
  } catch {
    // Never let review plumbing break app launch.
  }
}
