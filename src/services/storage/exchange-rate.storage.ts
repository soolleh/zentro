import type { Result } from '@/shared/types/common.types';
import type { ExchangeRate } from '@/shared/types/exchange.types';
import type { Currency } from '@/shared/types/common.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const exchangeRateStorage = {
  async upsertExchangeRate(_rate: ExchangeRate): Promise<Result<ExchangeRate>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getExchangeRate(
    _fromCurrency: Currency,
    _toCurrency: Currency
  ): Promise<Result<ExchangeRate>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listExchangeRates(): Promise<Result<ExchangeRate[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
