import { ToolError } from '../tool';
import { GetDecksTool } from './getDecksTool';

const VALID_STATES = new Set(['new', 'due', 'learn', 'review', 'suspended', 'buried']);

export type FindArgs = {
	deck: string;
	rated_days?: number;
	rated_ease?: number;
	states?: string[];
	props?: string[];
	field?: string;
	term?: string;
};

export const FIND_PARAMETERS = [
	{
		name: 'deck',
		type: 'string',
		description: 'Deck name to search in.',
		required: true
	},
	{
		name: 'rated_days',
		type: 'integer',
		description: 'Limit to cards rated within the last N days (1 = today).',
		required: false
	},
	{
		name: 'rated_ease',
		type: 'integer',
		description:
			'Rating to filter by: 1=Again(failed), 2=Hard, 3=Good, 4=Easy. Only applies when rated_days is set. Omit to match any rating.',
		required: false
	},
	{
		name: 'states',
		type: 'array',
		items: { type: 'string' },
		description: 'Card state filters. Valid values: new, due, learn, review, suspended, buried.',
		required: false
	},
	{
		name: 'props',
		type: 'array',
		items: { type: 'string' },
		description: 'Property comparisons without the prop: prefix, e.g. lapses>3, ease<2.5, ivl<=7.',
		required: false
	},
	{
		name: 'field',
		type: 'string',
		description:
			'Note field to search in (e.g. Expression, Front, Meaning). Must be set together with term.',
		required: false
	},
	{
		name: 'term',
		type: 'string',
		description:
			'Text to search for within field. Use * as wildcard — *犬* matches anything containing 犬, 犬* matches values starting with 犬.',
		required: false
	}
] as const;

export const FIND_DESCRIPTION =
	'rated_days + rated_ease — cards reviewed in the last N days with a specific rating\n' +
	'  rated_ease: 1=Again (failed), 2=Hard, 3=Good, 4=Easy\n' +
	"  Today's failed cards → rated_days:1, rated_ease:1\n" +
	'  Last 7 days failed  → rated_days:7, rated_ease:1\n' +
	'  Omit rated_ease to match any rating within rated_days\n' +
	'\n' +
	'states — card state filters (array)\n' +
	'  new, due, learn, review, suspended, buried\n' +
	'\n' +
	'props — property comparisons without the prop: prefix (array)\n' +
	'  lapses>3, ease<2.5, ivl<=7, reps<5\n' +
	'\n' +
	'field + term — search for text within a specific field (both required together)\n' +
	'  Use * as wildcard: *犬* matches any field value containing 犬\n' +
	'  field:Expression term:*犬* → Expression field contains 犬';

export async function validateFindArgs(args: Record<string, unknown>): Promise<FindArgs> {
	const decks = JSON.parse(await new GetDecksTool().execute()) as string[];

	if (typeof args.deck !== 'string' || args.deck.trim() === '') {
		throw new ToolError('deck must be a non-empty string.');
	}
	if (!decks.includes(args.deck)) {
		throw new ToolError(`deck "${args.deck}" doesn't exist.`);
	}

	if (args.rated_days !== undefined) {
		if (!Number.isInteger(args.rated_days) || (args.rated_days as number) < 1) {
			throw new ToolError('rated_days must be a positive integer.');
		}
	}
	if (args.rated_ease !== undefined) {
		if (args.rated_days === undefined) {
			throw new ToolError('rated_ease requires rated_days to be set.');
		}
		if (![1, 2, 3, 4].includes(args.rated_ease as number)) {
			throw new ToolError('rated_ease must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy).');
		}
	}

	if (args.states !== undefined) {
		if (!Array.isArray(args.states)) throw new ToolError('states must be an array.');
		for (const state of args.states) {
			if (!VALID_STATES.has(state as string)) {
				throw new ToolError(
					`Invalid state "${state}". Valid values: ${[...VALID_STATES].join(', ')}.`
				);
			}
		}
	}

	if (args.props !== undefined && !Array.isArray(args.props)) {
		throw new ToolError('props must be an array.');
	}

	if (args.field !== undefined || args.term !== undefined) {
		if (typeof args.field !== 'string' || typeof args.term !== 'string') {
			throw new ToolError('term and field need to be defined together as string.');
		}
	}

	return {
		deck: args.deck,
		rated_days: args.rated_days as number | undefined,
		rated_ease: args.rated_ease as number | undefined,
		states: args.states as string[] | undefined,
		props: args.props as string[] | undefined,
		field: args.field as string | undefined,
		term: args.term as string | undefined
	};
}

export function buildFindQuery(args: FindArgs): string {
	const parts: string[] = [];
	parts.push(`deck:"${args.deck}"`);

	if (args.rated_days !== undefined) {
		parts.push(
			args.rated_ease !== undefined
				? `rated:${args.rated_days}:${args.rated_ease}`
				: `rated:${args.rated_days}`
		);
	}

	for (const state of args.states ?? []) parts.push(`is:${state}`);
	for (const p of args.props ?? []) parts.push(`prop:${p}`);
	if (args.field && args.term) parts.push(`${args.field}:${args.term}`);

	return parts.join(' ');
}
