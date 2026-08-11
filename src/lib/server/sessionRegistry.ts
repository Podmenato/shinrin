import { getRequestEvent } from '$app/server';

type Listener = () => void;

type SessionRun = {
	controller: AbortController;
	text: string;
};

/**
 * Tracks each session's in-progress `run()`: the `AbortController` a `cancelAgent` request can
 * act on, and the streamed reply text a `query.live` subscriber watches.
 */
class SessionRegistry {
	private runs = new Map<string, SessionRun>();
	private listeners = new Map<string, Set<Listener>>();

	/** Marks a session as actively running, starting from an empty reply. */
	start(sessionId: string, controller: AbortController): void {
		this.runs.set(sessionId, { controller, text: '' });
		this.notify(sessionId);
	}

	/** Appends a text delta to the session's in-progress reply. */
	append(sessionId: string, delta: string): void {
		const run = this.runs.get(sessionId);
		if (!run) {
			return;
		}

		run.text += delta;
		this.notify(sessionId);
	}

	/** Marks a session as no longer running. */
	end(sessionId: string): void {
		this.runs.delete(sessionId);
		this.notify(sessionId);
	}

	/** Cancels the session's active run, if any. Returns whether one was found. */
	cancel(sessionId: string): boolean {
		const run = this.runs.get(sessionId);
		if (!run) {
			return false;
		}
		run.controller.abort();
		return true;
	}

	/** The session's current in-progress reply text, or `null` if none is active. */
	get(sessionId: string): string | null {
		return this.runs.get(sessionId)?.text ?? null;
	}

	/**
	 * Yields the session's in-progress reply text whenever it changes, until the client
	 * disconnects. Ends on its own once that happens, instead of waiting on the session
	 * itself to do something again — which might never happen.
	 */
	async *subscribe(sessionId: string): AsyncGenerator<string | null> {
		const { signal } = getRequestEvent().request;
		let last: string | null | undefined;

		while (!signal.aborted) {
			const current = this.get(sessionId);
			if (current !== last) {
				last = current;
				yield current;
			}
			await this.next(sessionId, signal);
		}
	}

	private next(sessionId: string, signal: AbortSignal): Promise<void> {
		return new Promise((resolve) => {
			let listeners = this.listeners.get(sessionId);

			if (!listeners) {
				listeners = new Set();
				this.listeners.set(sessionId, listeners);
			}
			const activeListeners = listeners;

			const finish = () => {
				activeListeners.delete(finish);
				signal.removeEventListener('abort', finish);
				resolve();
			};

			activeListeners.add(finish);
			signal.addEventListener('abort', finish, { once: true });
		});
	}

	private notify(sessionId: string): void {
		const listeners = this.listeners.get(sessionId);
		if (!listeners) {
			return;
		}

		this.listeners.delete(sessionId);

		for (const listener of listeners) {
			listener();
		}
	}
}

export const sessionRegistry = new SessionRegistry();
