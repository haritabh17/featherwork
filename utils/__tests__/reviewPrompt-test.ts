import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { appAlert, AppAlertButton } from '../appAlert';
import { maybeAskQuarterlyReview, QUARTER_MS, recordSaveForReviewPrompt } from '../reviewPrompt';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use import
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-store-review', () => ({
  hasAction: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));
jest.mock('../appAlert', () => ({ appAlert: jest.fn() }));

const mockedReview = StoreReview as jest.Mocked<typeof StoreReview>;
const mockedAlert = appAlert as jest.MockedFunction<typeof appAlert>;
const mockedOpenURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

describe('recordSaveForReviewPrompt', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockedReview.hasAction.mockResolvedValue(true);
  });

  it('does not prompt on the first save', async () => {
    await recordSaveForReviewPrompt();
    expect(mockedReview.requestReview).not.toHaveBeenCalled();
  });

  it('prompts exactly once at the engagement threshold', async () => {
    await recordSaveForReviewPrompt();
    await recordSaveForReviewPrompt();
    expect(mockedReview.requestReview).toHaveBeenCalledTimes(1);

    await recordSaveForReviewPrompt();
    await recordSaveForReviewPrompt();
    expect(mockedReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('retries later when the review action is unavailable', async () => {
    mockedReview.hasAction.mockResolvedValue(false);
    await recordSaveForReviewPrompt();
    await recordSaveForReviewPrompt();
    expect(mockedReview.requestReview).not.toHaveBeenCalled();

    mockedReview.hasAction.mockResolvedValue(true);
    await recordSaveForReviewPrompt();
    expect(mockedReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('never throws even when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(recordSaveForReviewPrompt()).resolves.toBeUndefined();
  });
});

describe('maybeAskQuarterlyReview', () => {
  const T0 = 1_700_000_000_000;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  const rateButton = (): AppAlertButton => {
    const buttons = mockedAlert.mock.calls.at(-1)?.[2] ?? [];
    const rate = buttons.find((b) => b.text.includes('rate'));
    expect(rate).toBeDefined();
    return rate!;
  };

  it('arms the timer on first launch without asking', async () => {
    await maybeAskQuarterlyReview(T0);
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it('asks only once a quarter has passed', async () => {
    await maybeAskQuarterlyReview(T0);
    await maybeAskQuarterlyReview(T0 + QUARTER_MS - 1000);
    expect(mockedAlert).not.toHaveBeenCalled();

    await maybeAskQuarterlyReview(T0 + QUARTER_MS + 1000);
    expect(mockedAlert).toHaveBeenCalledTimes(1);
  });

  it('re-asks each quarter until the user rates', async () => {
    await maybeAskQuarterlyReview(T0);
    await maybeAskQuarterlyReview(T0 + QUARTER_MS + 1000);
    expect(mockedAlert).toHaveBeenCalledTimes(1);

    // Dismissed without rating: quiet until the next quarter, then asks again.
    await maybeAskQuarterlyReview(T0 + QUARTER_MS + 2000);
    expect(mockedAlert).toHaveBeenCalledTimes(1);
    await maybeAskQuarterlyReview(T0 + 2 * QUARTER_MS + 2000);
    expect(mockedAlert).toHaveBeenCalledTimes(2);
  });

  it('opens the Play listing and never asks again after rating', async () => {
    await maybeAskQuarterlyReview(T0);
    await maybeAskQuarterlyReview(T0 + QUARTER_MS + 1000);
    rateButton().onPress?.();
    await Promise.resolve();
    expect(mockedOpenURL).toHaveBeenCalledWith(expect.stringContaining('market://details'));

    await maybeAskQuarterlyReview(T0 + 5 * QUARTER_MS);
    expect(mockedAlert).toHaveBeenCalledTimes(1);
  });
});
