const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Persistent-ish dedup store with TTL and periodic disk sync
const PROCESS_START_MS = Date.now();
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds (disk persistence TTL)
const MAX_ENTRIES = 2000; // safeguard

let cache = new Map(); // id/key -> ts
let loaded = false;

function load() {
  // In-memory only: no-op loader
  if (loaded) return;
  loaded = true;
}

function prune(now = Date.now(), ttl = DEFAULT_TTL_MS) {
  for (const [k, ts] of cache) {
    if (now - ts > ttl) cache.delete(k);
  }
  // hard cap
  if (cache.size > MAX_ENTRIES) {
    // delete oldest
    const arr = Array.from(cache.entries()).sort((a, b) => a[1] - b[1]);
    const toDelete = cache.size - MAX_ENTRIES;
    for (let i = 0; i < toDelete; i++) {
      cache.delete(arr[i][0]);
    }
  }
}

let lastPersist = 0;
const PERSIST_INTERVAL_MS = 10 * 1000; // retained for API compatibility

function persist(force = false) {
  // In-memory only: no persistence to disk
  lastPersist = Date.now();
}

// ---------- Normalização centralizada ----------
function stripDiacritics(str) {
  try {
    return str.normalize('NFD').replace(/\p{M}+/gu, '');
  } catch (_) {
    // Fallback sem unicode properties
    return str;
  }
}

/**
 * Normaliza o corpo para deduplicação.
 * Regras:
 * - Se contiver exatamente 11 dígitos (CPF), retorna apenas os dígitos (kind='cpf')
 * - Caso geral: remove acentos, minúsculas, colapsa espaços e trim (kind='text')
 */
function normalizeBodyForDedup(text) {
  const raw = (text || '').toString();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) {
    return { normalized: digits, kind: 'cpf' };
  }
  const noDiacritics = stripDiacritics(raw);
  const lowered = noDiacritics.toLowerCase();
  const collapsed = lowered.replace(/\s+/g, ' ').trim();
  return { normalized: collapsed, kind: 'text' };
}

function hashString(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex');
}

function getEnvMs(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function isDuplicate(id, ttlMs = DEFAULT_TTL_MS) {
  if (!id) return false;
  load();
  const now = Date.now();
  prune(now, ttlMs);
  if (cache.has(id)) {
    const seenAt = cache.get(id);
    // If the entry is from before this process started, treat as new
    if (seenAt < PROCESS_START_MS) {
      cache.set(id, now);
      persist();
      return false;
    }
    return true;
  }
  cache.set(id, now);
  persist();
  return false;
}

function isDuplicateKey(key, ttlMs = DEFAULT_TTL_MS) {
  return isDuplicate(key, ttlMs);
}

module.exports = { isDuplicate, isDuplicateKey, normalizeBodyForDedup, hashString, getEnvMs };
