import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StepSet } from '../types/drill';
import { appAlert } from '../utils/appAlert';
import { recordSaveForReviewPrompt } from '../utils/reviewPrompt';

const STORAGE_KEY = 'badminton-step-sets';
/** Free tier keeps this many saved drills; Drill Vault Pro lifts the cap. */
export const STEP_SET_LIMIT = 5;

interface UseStepSetsOptions {
  /** Pro subscribers save without the cap. */
  isPro?: boolean;
  /** Overrides the default limit alert (e.g. to pitch the upgrade). */
  onLimitReached?: () => void;
}

export function useStepSets({ isPro = false, onLimitReached }: UseStepSetsOptions = {}) {
  const [stepSets, setStepSets] = useState<StepSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadStepSets = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!isMounted) return;

        if (stored) {
          setStepSets(JSON.parse(stored) as StepSet[]);
        }
      } catch (error) {
        console.error('Failed to load step sets:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStepSets();

    return () => {
      isMounted = false;
    };
  }, []);

  const writeToStorage = (nextStepSets: StepSet[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextStepSets)).catch((error) => {
      console.error('Failed to save step sets:', error);
    });
  };

  // saveStepSet gates on the current list for the cap, so unlike the others
  // it changes identity when the list does; callers already tolerate that.
  // Returns null (after alerting) when the limit is hit.
  const saveStepSet = useCallback(async (stepSet: StepSet) => {
    const isUpdate = stepSets.some((existing) => existing.id === stepSet.id);
    if (!isUpdate && !isPro && stepSets.length >= STEP_SET_LIMIT) {
      if (onLimitReached) {
        onLimitReached();
      } else {
        appAlert(
          'Drill limit reached',
          `Up to ${STEP_SET_LIMIT} drills can be saved. Delete one to make room.`
        );
      }
      return null;
    }
    setStepSets((prev) => {
      const next = [stepSet, ...prev.filter((existing) => existing.id !== stepSet.id)];
      writeToStorage(next);
      return next;
    });
    // Fire-and-forget: a successful save is the engagement signal for the
    // one-time Play in-app review prompt.
    recordSaveForReviewPrompt();
    return stepSet;
  }, [stepSets, isPro, onLimitReached]);

  // Functional updates keep the remaining callbacks stable across renders.
  const deleteStepSet = useCallback(async (id: string) => {
    setStepSets((prev) => {
      const next = prev.filter((stepSet) => stepSet.id !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const replaceStepSet = useCallback(async (existingId: string, stepSet: StepSet) => {
    setStepSets((prev) => {
      const next = [
        stepSet,
        ...prev.filter((item) => item.id !== existingId && item.id !== stepSet.id),
      ];
      writeToStorage(next);
      return next;
    });
    return stepSet;
  }, []);

  const importStepSet = useCallback(
    async (stepSet: StepSet) => saveStepSet(stepSet),
    [saveStepSet]
  );

  return {
    stepSets,
    isLoading,
    saveStepSet,
    deleteStepSet,
    replaceStepSet,
    importStepSet,
  };
}
