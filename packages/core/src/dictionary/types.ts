export type DictionaryAdapterId = "youdao-web" | "cambridge-web";

export interface DictionaryLookupRequest {
  readonly term: string;
  readonly language: string;
}

export interface DictionaryLookupResult {
  readonly adapterId: DictionaryAdapterId;
  readonly term: string;
  readonly entries: readonly string[];
}

export interface DictionaryAdapter {
  readonly id: DictionaryAdapterId;
  lookup(request: DictionaryLookupRequest): Promise<DictionaryLookupResult>;
}
