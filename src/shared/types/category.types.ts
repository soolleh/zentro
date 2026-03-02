import type { UUID, ISODateString } from './common.types';

export type Category = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly isSystem: boolean;
  readonly parentId?: UUID;
  readonly sortOrder: number;
  readonly createdAt: ISODateString;
};
