import type { SaveVocabularyInput, SaveVocabularyResult } from "./ports";

export interface SaveVocabularyService {
  save(input: SaveVocabularyInput): Promise<SaveVocabularyResult>;
}
