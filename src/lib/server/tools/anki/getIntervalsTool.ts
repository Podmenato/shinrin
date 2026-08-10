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

	private controller: AbortController | null = null;

	async execute(args: Record<string, unknown>): Promise<string> {
		this.controller = new AbortController();

		const complete = args.complete === true;
		const action = complete ? 'getIntervalsOfCards' : 'getIntervals';

		try {
			const intervals = await ankiRequest<number[] | number[][]>(
				action,
				{ cards: args.cardIds },
				this.controller.signal
			);
			return JSON.stringify(intervals);
		} finally {
			this.controller = null;
		}
	}

	cancel(): Promise<string> {
		this.controller?.abort();
		return Promise.resolve('Cancelled by user.');
	}
}
