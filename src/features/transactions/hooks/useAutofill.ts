import { useState, useEffect, useCallback } from 'react';
import type { AutofillSuggestion } from '@/shared/types/transaction.types';
import type { UUID } from '@/shared/types/common.types';
import { autofillSuggestion } from '@/services/transactions/transaction.service';

type UseAutofillOptions = {
  userId: UUID;
  cryptoKey: CryptoKey | null;
};

type UseAutofillReturn = {
  suggestion: AutofillSuggestion | null;
  isLoading: boolean;
  clearSuggestion: () => void;
};

/**
 * Debounced autofill hook for transaction notes.
 * Triggers after the user types >= 3 characters.
 */
export function useAutofill(
  partialNotes: string,
  { userId, cryptoKey }: UseAutofillOptions
): UseAutofillReturn {
  const [suggestion, setSuggestion] = useState<AutofillSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  useEffect(() => {
    if (!cryptoKey || partialNotes.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestion(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      void autofillSuggestion(userId, partialNotes, cryptoKey).then((result) => {
        setIsLoading(false);
        if (result.success) {
          setSuggestion(result.data);
        } else {
          setSuggestion(null);
        }
      });
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [partialNotes, userId, cryptoKey]);

  return { suggestion, isLoading, clearSuggestion };
}
