import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function openDb(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Run `fn` inside one transaction; roll back if it throws. */
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Shared pager: validates page/page_size the same way for every list endpoint. */
export const PAGE_SIZES = [10, 20, 30, 50];

export function readPage(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.page_size === undefined ? 10 : Number(query.page_size);
  if (!Number.isInteger(page) || page < 1 || !PAGE_SIZES.includes(pageSize)) return null;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageResult(items, total, { page, pageSize }) {
  return { items, total, page, page_size: pageSize };
}
