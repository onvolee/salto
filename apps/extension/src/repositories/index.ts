import type { LearningRepository, VocabularyRepository } from "@salto/core";

export interface ExtensionRepositories {
  readonly vocabularyRepository: VocabularyRepository;
  readonly learningRepository: LearningRepository;
}
