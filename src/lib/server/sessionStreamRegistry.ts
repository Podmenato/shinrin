import { getRequestEvent } from '$app/server';

type Listener = () => void;

/**
 * Tracks the in-progress assistant reply text per session.
 */
class SessionStreamRegistry {
	private streams = new Map<string, string>();
	private listeners = new Map<string, Set<Listener>>();

	/** Marks a session as actively generating a reply, starting from an empty string. */
	start(sessionId: string): void {
		this.streams.set(sessionId, '');
		this.notify(sessionId);
	}

	/** Appends a text delta to the session's in-progress reply. */
	append(sessionId: string, delta: string): void {
		const text = this.streams.get(sessionId);
		if (text === undefined) {
			return;
		}

		this.streams.set(sessionId, text + delta);
		this.notify(sessionId);
	}

	/** Marks a session as no longer generating a reply. */
	end(sessionId: string): void {
		this.streams.delete(sessionId);
		this.notify(sessionId);
	}

	/** The session's current in-progress reply text, or `null` if none is active. */
	get(sessionId: string): string | null {
		return this.streams.get(sessionId) ?? null;
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

export const sessionStreams = new SessionStreamRegistry();
