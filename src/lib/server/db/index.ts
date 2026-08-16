import { createDb } from './createDb';
import { currentMode, dbPath } from '../env';

export * from './createDb';
export const db = createDb(process.env.VITEST ? ':memory:' : dbPath(currentMode()));
