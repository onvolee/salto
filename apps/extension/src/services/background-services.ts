import type { DictionaryAdapter, LearningRepository, LlmClient, VocabularyRepository } from "@salto/core";

export interface BackgroundServiceDependencies {
  readonly vocabularyRepository: VocabularyRepository;
  readonly learningRepository: LearningRepository;
  readonly llmClient: LlmClient;
  readonly dictionaryAdapters: readonly DictionaryAdapter[];
}

export type BackgroundServices = BackgroundServiceDependencies;
