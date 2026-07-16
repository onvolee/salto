export type ClientGeneratedId = string;
export type IsoDateTimeString = string;

export interface SyncMetadata {
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly recordVersion: number;
  readonly deletedAt?: IsoDateTimeString;
}
