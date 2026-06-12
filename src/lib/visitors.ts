const SESSION_TTL_MS = 45_000;

type VisitorStore = Map<string, number>;

declare global {
  // eslint-disable-next-line no-var
  var __tvVisitorStore: VisitorStore | undefined;
}

function getStore(): VisitorStore {
  if (!globalThis.__tvVisitorStore) {
    globalThis.__tvVisitorStore = new Map();
  }
  return globalThis.__tvVisitorStore;
}

function pruneStore(store: VisitorStore) {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, lastSeen] of store.entries()) {
    if (lastSeen < cutoff) store.delete(id);
  }
}

export function touchVisitor(sessionId: string): number {
  const store = getStore();
  store.set(sessionId, Date.now());
  pruneStore(store);
  return store.size;
}

export function removeVisitor(sessionId: string): number {
  const store = getStore();
  store.delete(sessionId);
  pruneStore(store);
  return store.size;
}

export function getLiveVisitorCount(): number {
  const store = getStore();
  pruneStore(store);
  return store.size;
}
