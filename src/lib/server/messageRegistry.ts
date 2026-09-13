type Listener = () => void;

/**
 * Notifies a session's `getSessionMessagesQuery` live-query subscribers whenever a message is
 * persisted for it, so the transcript updates as messages land instead of only once a run
 * finishes. Carries no state of its own — messages live in SQLite; this is just the
 * wait/notify signal that tells a subscriber to re-read them. Same wait/notify shape as
 * `SessionRegistry`, minus the in-progress-reply state that one also tracks.
 */
class MessageRegistry {
	private listeners = new Map<string, Set<Listener>>();

	/** Wakes a session's subscribers, if any. */
	notify(sessionId: string): void {
		const listeners = this.listeners.get(sessionId);
		if (!listeners) {
			return;
		}

		this.listeners.delete(sessionId);

		for (const listener of listeners) {
			listener();
		}
	}

	/** Resolves on the next `notify(sessionId)` call, or once `signal` aborts. */
	next(sessionId: string, signal: AbortSignal): Promise<void> {
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
}

export const messageRegistry = new MessageRegistry();
