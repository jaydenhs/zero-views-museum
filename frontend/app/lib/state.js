// Simple in-memory store for canvas statuses
// Note: Resets on serverless cold start. Good enough for initial polling.

const store = new Map();

// Default structure: { lookedAt: boolean, updatedAt: number }

export function getCanvasState(id) {
  if (!store.has(id)) {
    store.set(id, { lookedAt: false, updatedAt: Date.now() });
  }
  return store.get(id);
}

export function setCanvasState(id, next) {
  const prev = getCanvasState(id);
  const merged = {
    lookedAt:
      typeof next.lookedAt === "boolean" ? next.lookedAt : prev.lookedAt,
    updatedAt: Date.now(),
  };
  store.set(id, merged);
  return merged;
}

export function toResponse(state) {
  return {
    lookedAt: !!state.lookedAt,
    updatedAt: state.updatedAt,
  };
}
