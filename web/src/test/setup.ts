import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement Element.scrollIntoView. Stub it once for every
// test rather than guarding every call site in components.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// jsdom 25 ships an empty Storage object - typeof localStorage is
// "object" but `.setItem` / `.getItem` / `.clear` / `.removeItem` are
// all undefined. Polyfill a working in-memory Storage so tests that
// reference `localStorage` directly (i18n, voertuigCache) behave.
function makeStorage(): Storage {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.has(key) ? store.get(key)! : null; },
    key(i: number) { return Array.from(store.keys())[i] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, String(value)); },
  };
  return storage;
}

function installStorage(name: "localStorage" | "sessionStorage") {
  const target = globalThis as unknown as Record<string, Storage>;
  const existing = target[name] as Storage | undefined;
  if (!existing || typeof existing.setItem !== "function") {
    target[name] = makeStorage();
    if (typeof window !== "undefined") {
      Object.defineProperty(window, name, { value: target[name], configurable: true });
    }
  }
}

installStorage("localStorage");
installStorage("sessionStorage");
