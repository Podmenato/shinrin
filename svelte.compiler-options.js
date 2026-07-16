// Shared between vite.config.ts and eslint.config.js. Not named svelte.config.js/.ts —
// SvelteKit 3 throws if either exists, since config now goes through the Vite plugin.
/** @type {import('svelte/compiler').CompileOptions} */
export const compilerOptions = {
	// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
	runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
	experimental: {
		async: true
	}
};
