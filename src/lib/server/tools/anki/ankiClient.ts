import ky, { isNetworkError, isTimeoutError } from 'ky';
import { ToolError } from '../tool';

const ANKI_CONNECT_URL = 'http://localhost:8765';
const ANKI_CONNECT_VERSION = 6;

type AnkiResponse<T> = {
	result: T;
	error: string | null;
};

export async function ankiRequest<T>(
	action: string,
	params: Record<string, unknown> = {},
	signal: AbortSignal
): Promise<T> {
	let data: AnkiResponse<T>;
	try {
		data = await ky
			.post(ANKI_CONNECT_URL, {
				json: { action, version: ANKI_CONNECT_VERSION, params },
				signal
			})
			.json<AnkiResponse<T>>();
	} catch (err) {
		// A cancellation surfaces as a fetch abort here too — let it propagate as-is rather than
		// relabeling it, so callers that check `signal.aborted` still can.
		if (signal.aborted) {
			throw err;
		}
		if (isNetworkError(err)) {
			throw new ToolError(
				'Could not reach Anki — make sure Anki is running with the AnkiConnect add-on installed.'
			);
		}
		if (isTimeoutError(err)) {
			throw new ToolError(
				"Anki isn't responding — it may be busy or have a dialog open that's blocking it."
			);
		}
		throw err;
	}

	if (data.error) {
		throw new ToolError(`AnkiConnect error: ${data.error}`);
	}

	return data.result;
}
