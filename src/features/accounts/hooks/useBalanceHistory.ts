/**
 * useBalanceHistory.ts
 *
 * Hook that fetches balance history for an account over a given period.
 */

import { useState, useEffect } from 'react';
import type { UUID } from '@/shared/types/common.types';
import type { BalanceHistoryPoint } from '@/shared/types/account.types';
import { getAccountBalanceHistory } from '@/services/accounts/account.service';
import { useDerivedKey } from '@/app/stores/session.store';

type UseBalanceHistoryResult = {
  history: BalanceHistoryPoint[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

export function useBalanceHistory(accountId: UUID | null, months: number): UseBalanceHistoryResult {
  const derivedKey = useDerivedKey();
  const [history, setHistory] = useState<BalanceHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!accountId || !derivedKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    void getAccountBalanceHistory(accountId, derivedKey, months).then((result) => {
      setIsLoading(false);
      if (result.success) {
        setHistory(result.data);
      } else {
        setError(result.error.message);
      }
    });
  }, [accountId, derivedKey, months, tick]);

  return {
    history,
    isLoading,
    error,
    reload: () => {
      setTick((t) => t + 1);
    },
  };
}
