import { json, error } from '@sveltejs/kit';

/** Returns the list of available model names from Ollama. */
export async function GET() {
	// TODO: make ollama independent
	const res = await fetch('http://localhost:11434/api/tags');
	if (!res.ok) error(502, 'Could not reach Ollama');

	const data = (await res.json()) as { models: { name: string }[] };
	return json(data.models.map((m) => m.name));
}
