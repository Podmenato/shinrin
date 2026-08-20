import { query } from '$app/server';
import { GetDecksTool } from '#lib/server/tools/anki/getDecksTool.js';
import { ANKI_CARD_STATES } from '#lib/server/tools/anki/findQuery.js';

/** Returns all Anki deck names, for populating a deck picker. */
export const getDecks = query(async (): Promise<string[]> => {
	return JSON.parse(await new GetDecksTool().execute({}, new AbortController().signal)) as string[];
});

/** Returns the valid `find` tool card-state filters, for populating a state picker. */
export const getCardStates = query(async () => ANKI_CARD_STATES);
