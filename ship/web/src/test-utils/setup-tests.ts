// Vitest setup file to polyfill minimal Web Storage API in Node environment
// Provides global Storage, localStorage, and sessionStorage so tests that spy on
// Storage.prototype methods (e.g., getItem) can run without a DOM.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    const value = this.store.get(String(key));
    return value === undefined ? null : value;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
}

// Attach polyfills to globalThis only if missing
const g: any = globalThis as any;
if (typeof g.Storage === 'undefined') {
  g.Storage = MemoryStorage as any;
}
if (typeof g.localStorage === 'undefined') {
  g.localStorage = new MemoryStorage();
}
if (typeof g.sessionStorage === 'undefined') {
  g.sessionStorage = new MemoryStorage();
}
