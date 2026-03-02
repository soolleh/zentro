export type Currency = string & { readonly _brand: 'Currency' };
export type UUID = string & { readonly _brand: 'UUID' };
export type ISODateString = string & { readonly _brand: 'ISODateString' };

export type AppError = {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
};

export type Result<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AppError };
