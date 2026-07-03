import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StepSet } from '../types/drill';

const STORAGE_KEY = 'badminton-step-sets';

export function useStepSets() {
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

  // Functional updates keep these callbacks stable across renders, so
  // consumers can safely list them in effect dependencies.
  const saveStepSet = useCallback(async (stepSet: StepSet) => {
    setStepSets((prev) => {
      const next = [stepSet, ...prev.filter((existing) => existing.id !== stepSet.id)];
      writeToStorage(next);
      return next;
    });
    return stepSet;
  }, []);

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
