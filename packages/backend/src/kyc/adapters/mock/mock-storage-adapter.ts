import type { StoreDocumentResult, StoragePort } from '../../ports/storage-port.js';

/**
 * Mock storage adapter that stores file refs in memory.
 * Used when MOCK_STORAGE=true (default for local dev/workshop).
 * Never logs file content or PII — only resource identifiers.
 */
export class MockStorageAdapter implements StoragePort {
  private readonly documents = new Map<string, { path: string; mimeType: string }>();

  async storeDocument(
    _fileBuffer: Buffer,
    path: string,
    mimeType: string,
  ): Promise<StoreDocumentResult> {
    const ref = `mock://documents/${path}`;
    this.documents.set(ref, { path, mimeType });
    return { ref };
  }

  async deleteDocument(ref: string): Promise<void> {
    this.documents.delete(ref);
  }

  /** Test helper: check if a document is stored. */
  hasDocument(ref: string): boolean {
    return this.documents.has(ref);
  }

  /** Test helper: get all stored document refs. */
  getStoredRefs(): string[] {
    return [...this.documents.keys()];
  }
}
