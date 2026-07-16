import type { Tool, ToolDefinition } from '../tool';
import { ankiRequest } from './ankiClient';

export class GetIntervalsTool implements Tool {
	definition: ToolDefinition = {
		name: 'get_intervals',
		description:
			'Returns interval data for a list of card IDs. By default returns only the most recent interval per card (positive = days, negative = seconds). Set complete=true to get the full interval history for each card.',
		parameters: [
			{
				name: 'cardIds',
				type: 'array',
				items: { type: 'integer' },
				description: 'Array of card IDs',
				required: true
			},
			{
				name: 'complete',
				type: 'boolean',
				description: 'If true, returns full interval history instead of just the most recent value',
				required: false
			}
		]
	};

	async execute(args: Record<string, unknown>): Promise<string> {
		const complete = args.complete === true;
		const action = complete ? 'getIntervalsOfCards' : 'getIntervals';
		const intervals = await ankiRequest<number[] | number[][]>(action, { cards: args.cardIds });
		return JSON.stringify(intervals);
	}

	cancel(): Promise<string> {
		return Promise.resolve('ok');
	}
}
