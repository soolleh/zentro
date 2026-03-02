/**
 * useAccountBalance.ts
 *
 * Hook that fetches and returns a single account's current balance.
 */

import { useState, useEffect } from 'react';
import type { UUID } from '@/shared/types/common.types';
import { getAccountBalance } from '@/services/accounts/account.service';
import { useDerivedKey } from '@/app/stores/session.store';

type UseAccountBalanceResult = {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

export function useAccountBalance(accountId: UUID | null): UseAccountBalanceResult {
  const derivedKey = useDerivedKey();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!accountId || !derivedKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    void getAccountBalance(accountId, derivedKey).then((result) => {
      setIsLoading(false);
      if (result.success) {
        setBalance(result.data);
      } else {
        setError(result.error.message);
      }
    });
  }, [accountId, derivedKey, tick]);

  return {
    balance,
    isLoading,
    error,
    reload: () => {
      setTick((t) => t + 1);
    },
  };
}
