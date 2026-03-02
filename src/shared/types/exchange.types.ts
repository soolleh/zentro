import type { UUID, ISODateString, Currency } from './common.types';

export type ExchangeRate = {
  readonly id: UUID;
  readonly fromCurrency: Currency;
  readonly toCurrency: Currency;
  readonly rate: number;
  readonly updatedAt: ISODateString;
};
