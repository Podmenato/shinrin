import type { Agent } from './agent';

/**
 * Tracks the `Agent` instance backing each session's in-progress `run()`, so a `cancelAgent`
 * request can reach it and call `cancel()`. Only top-level sessions are registered here; a
 * canceled agent's `cancel()` call cascades into any subagent it's currently running via
 * `SubagentTool`, so nested sessions don't need entries of their own.
 */
class ActiveAgentRegistry {
	private agents = new Map<string, Agent>();

	register(sessionId: string, agent: Agent): void {
		this.agents.set(sessionId, agent);
	}

	unregister(sessionId: string): void {
		this.agents.delete(sessionId);
	}

	/** Cancels the session's active run, if any. Returns whether one was found. */
	async cancel(sessionId: string): Promise<boolean> {
		const agent = this.agents.get(sessionId);
		if (!agent) {
			return false;
		}
		await agent.cancel();
		return true;
	}
}

export const activeAgents = new ActiveAgentRegistry();
