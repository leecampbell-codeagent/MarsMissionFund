export interface StoreDocumentResult {
  readonly ref: string; // Resource identifier (not full URL) — never contains PII
}

export interface StoragePort {
  storeDocument(fileBuffer: Buffer, path: string, mimeType: string): Promise<StoreDocumentResult>;
  deleteDocument(ref: string): Promise<void>;
}
