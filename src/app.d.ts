// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Injected by vite.config.ts's `define`, from package.json's version.
	const __APP_VERSION__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
