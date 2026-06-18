import { query } from '$app/server';

/** Returns the list of available model names from Ollama. */
export const getModels = query(async () => {
	// TODO: make provider independent
	const res = await fetch('http://localhost:11434/api/tags');
	if (!res.ok) throw new Error('Could not reach Ollama');
	const data = (await res.json()) as { models: { name: string }[] };
	return data.models.map((m) => m.name);
});
