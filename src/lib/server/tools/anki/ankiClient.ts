import ky from 'ky';
import { ToolError } from '../tool';

const ANKI_CONNECT_URL = 'http://localhost:8765';
const ANKI_CONNECT_VERSION = 6;

type AnkiResponse<T> = {
	result: T;
	error: string | null;
};

export async function ankiRequest<T>(
	action: string,
	params: Record<string, unknown> = {}
): Promise<T> {
	const data = await ky
		.post(ANKI_CONNECT_URL, {
			json: { action, version: ANKI_CONNECT_VERSION, params }
		})
		.json<AnkiResponse<T>>();

	if (data.error) {
		throw new ToolError(`AnkiConnect error: ${data.error}`);
	}

	return data.result;
}
