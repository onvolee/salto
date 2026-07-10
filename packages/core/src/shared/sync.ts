export type ClientGeneratedId = string;
export type IsoDateTimeString = string;

export interface SyncMetadata {
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly version: number;
  readonly deletedAt?: IsoDateTimeString;
}
