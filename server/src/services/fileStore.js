import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

const locks = new Map();

async function acquireLock(file) {
  while (locks.get(file)) {
    await new Promise((r) => setTimeout(r, 10));
  }
  locks.set(file, true);
}

function releaseLock(file) {
  locks.delete(file);
}

export async function readJSON(filename) {
  const filePath = join(DATA_DIR, filename);
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

export async function writeJSON(filename, data) {
  const filePath = join(DATA_DIR, filename);
  await acquireLock(filename);
  try {
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } finally {
    releaseLock(filename);
  }
}

export async function updateJSON(filename, updater) {
  await acquireLock(filename);
  try {
    const data = await readJSON(filename);
    const updated = updater(data);
    const filePath = join(DATA_DIR, filename);
    await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } finally {
    releaseLock(filename);
  }
}
