import { command, form, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { agents, quickAsks } from '#lib/server/db/schema.js';
import { ANKI_CARD_STATES } from '#lib/server/tools/anki/findQuery.js';
import { FindTool } from '#lib/server/tools/anki/findTool.js';
import { CardsInfoTool } from '#lib/server/tools/anki/cardsInfoTool.js';
import { createSession } from '#lib/agents.remote.js';
import { desc, eq, getColumns, type InferSelectModel } from 'drizzle-orm';
import type { JsonValue } from '#lib/json.js';
import * as v from 'valibot';

export type QuickAskRow = InferSelectModel<typeof quickAsks>;
export type QuickAsk = QuickAskRow & { agentName: string };

/** Returns all quick asks, including the agent name, most recently updated first. */
export const getQuickAsks = query(async (): Promise<QuickAsk[]> => {
	return db
		.select({ ...getColumns(quickAsks), agentName: agents.name })
		.from(quickAsks)
		.innerJoin(agents, eq(quickAsks.agentId, agents.id))
		.orderBy(desc(quickAsks.updatedAt));
});

/** Returns a single quick ask by id. */
export const getQuickAskById = query(
	v.pipe(v.string(), v.uuid()),
	async (id): Promise<QuickAskRow> => {
		const quickAsk = await db.query.quickAsks.findFirst({ where: { id } });
		if (!quickAsk) {
			error(404, 'Quick ask not found');
		}
		return quickAsk;
	}
);

/** Creates or updates a quick ask preset. */
export const saveQuickAsk = form(
	v.object({
		id: v.optional(v.pipe(v.string(), v.uuid())),
		name: v.pipe(v.string(), v.nonEmpty()),
		agentId: v.pipe(v.string(), v.uuid()),
		model: v.pipe(v.string(), v.nonEmpty()),
		deck: v.pipe(v.string(), v.nonEmpty()),
		state: v.picklist(ANKI_CARD_STATES),
		days: v.optional(v.string(), ''),
		prompt: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ id, name, agentId, model, deck, state, days, prompt }) => {
		const daysValue = days.trim() === '' ? null : Number(days);
		if (daysValue !== null && (!Number.isInteger(daysValue) || daysValue < 1)) {
			error(400, 'Days must be a positive integer');
		}

		const values = { name, agentId, model, deck, state, days: daysValue, prompt };

		let quickAsk;
		if (id) {
			[quickAsk] = await db
				.update(quickAsks)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(quickAsks.id, id))
				.returning();
			if (!quickAsk) {
				error(404, 'Quick ask not found');
			}
		} else {
			[quickAsk] = await db.insert(quickAsks).values(values).returning();
		}

		await getQuickAsks().refresh();
		if (id) {
			await getQuickAskById(id).refresh();
		}
		return quickAsk;
	}
);

/** Permanently deletes a quick ask preset. */
export const deleteQuickAsk = command(v.pipe(v.string(), v.uuid()), async (id) => {
	await db.delete(quickAsks).where(eq(quickAsks.id, id));
	await getQuickAsks().refresh();
});

/**
 * Prepares a quick ask: deterministically pre-fetches the matching cards via AnkiConnect — the
 * same `find` + `cards_info` tools an agent would call itself, just with args taken from the
 * stored preset instead of decided by a model — and pastes them into the configured prompt. This
 * is the whole point of a quick ask: skip the tool-call round trips (and their latency) an agent
 * would otherwise need to fetch the same cards.
 *
 * Creates the session but deliberately does *not* start the agent run itself — that stays a
 * client-initiated `runAgent` call (see `run-quick-ask-action.svelte`), matching every other
 * session-starting flow in the app, so the calling tab's `runAgent.pending` reflects the run and
 * the session screen's cancel button / composer-disabled state work correctly after redirect.
 */
export const runQuickAsk = command(
	v.pipe(v.string(), v.uuid()),
	async (id): Promise<{ session: { id: string }; seedPrompt: string }> => {
		const quickAsk = await db.query.quickAsks.findFirst({ where: { id } });
		if (!quickAsk) {
			error(404, 'Quick ask not found');
		}

		const signal = new AbortController().signal;
		const findArgs: Record<string, JsonValue> = { deck: quickAsk.deck, states: [quickAsk.state] };
		if (quickAsk.days !== null) findArgs.added = quickAsk.days;

		const cardIds = JSON.parse(await new FindTool().execute(findArgs, signal)) as number[];
		const cardsJson = await new CardsInfoTool().execute({ cardIds }, signal);

		const seedPrompt = `${quickAsk.prompt}\n\nCards:\n${cardsJson}`;

		const session = await createSession({
			agentId: quickAsk.agentId,
			name: quickAsk.name,
			model: quickAsk.model
		});

		return { session, seedPrompt };
	}
);
