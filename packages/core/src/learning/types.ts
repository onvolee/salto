import type { ClientGeneratedId, IsoDateTimeString, SyncMetadata } from "../shared/sync";
import type { VocabularyFieldKey } from "../vocabulary/types";

export const MEANING_RECALL_CARD_TYPE = "meaning-recall" as const;

export type LearningCardType = typeof MEANING_RECALL_CARD_TYPE;
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type LearningQueueState = "new" | "learning" | "review" | "relearning";

export interface LearningCard {
  readonly id: ClientGeneratedId;
  readonly vocabularyItemId: ClientGeneratedId;
  readonly cardType: LearningCardType;
  readonly frontFieldKeys: readonly VocabularyFieldKey[];
  readonly backFieldKeys: readonly VocabularyFieldKey[];
  readonly sync: SyncMetadata;
}

export interface LearningState {
  readonly id: ClientGeneratedId;
  readonly learningCardId: ClientGeneratedId;
  readonly dueAt: IsoDateTimeString;
  readonly stability: number;
  readonly difficulty: number;
  readonly scheduledDays: number;
  readonly reviewCount: number;
  readonly lapseCount: number;
  readonly state: LearningQueueState;
  readonly lastReviewAt?: IsoDateTimeString;
  readonly sync: SyncMetadata;
}

export interface ReviewLog {
  readonly id: ClientGeneratedId;
  readonly learningCardId: ClientGeneratedId;
  readonly rating: ReviewRating;
  readonly reviewedAt: IsoDateTimeString;
  readonly elapsedMs?: number;
  readonly sync: SyncMetadata;
}

export interface LearningRepository {
  getCard(id: ClientGeneratedId): Promise<LearningCard | undefined>;
  findCardByItemAndType(
    vocabularyItemId: ClientGeneratedId,
    cardType: LearningCardType
  ): Promise<LearningCard | undefined>;
  getState(learningCardId: ClientGeneratedId): Promise<LearningState | undefined>;
  saveCard(card: LearningCard): Promise<void>;
  saveState(state: LearningState): Promise<void>;
  appendReviewLog(log: ReviewLog): Promise<void>;
}
