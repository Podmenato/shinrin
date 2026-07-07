import type { ModelProvider } from './modelProviders/modelProvider';
import { ContextManager, type Message } from './contextManager';
import type { Tool } from './tools/tool';
import { ToolError } from './tools/tool';
import { logger } from './logger';
import { db } from './db/index';
import { eq } from 'drizzle-orm';
import { agents, sessions } from './db/schema';
import { getTools } from './tools/toolRegistry';

const MAX_ITERATIONS = 7;

export class Agent {
	private provider: ModelProvider;
	private ctx: ContextManager;
	private tools: Tool[];
	readonly agentId: string;

	constructor(agentId: string, provider: ModelProvider, ctx: ContextManager, tools: Tool[] = []) {
		this.agentId = agentId;
		this.provider = provider;
		this.ctx = ctx;
		this.tools = tools;
	}

	static async create(
		agentId: string,
		name: string,
		model: string,
		modelProvider: ModelProvider
	): Promise<Agent> {
		const agent = await db.query.agents.findFirst({
			where: eq(agents.id, agentId),
			with: { agentTools: { with: { tool: true } } }
		});

		if (agent === undefined) {
			throw new Error(`Agent with id ${agentId} not found in the database.`);
		}

		const tools = getTools(
			agent.agentTools.map((at) => at.tool.name),
			{ agentId }
		);

		const [session] = await db.insert(sessions).values({ agentId, name, model }).returning();

		const contextManager = new ContextManager(agent.systemPrompt ?? '', session.id);

		return new Agent(agentId, modelProvider, contextManager, tools);
	}

	static async createFromSession(sessionId: string, modelProvider: ModelProvider): Promise<Agent> {
		const session = await db.query.sessions.findFirst({
			where: eq(sessions.id, sessionId),
			with: { agent: { with: { agentTools: { with: { tool: true } } } } }
		});

		if (session === undefined) {
			throw new Error(`Session with id ${sessionId} not found in the database.`);
		}

		const agentId = session.agent.id;
		const tools = getTools(
			session.agent.agentTools.map((at) => at.tool.name),
			{ agentId }
		);

		const contextManager = new ContextManager(session.agent.systemPrompt ?? '', session.id);
		await contextManager.load();

		return new Agent(agentId, modelProvider, contextManager, tools);
	}

	async compact(): Promise<void> {
		await this.ctx.compact(this.provider);
	}

	async run(prompt: string): Promise<string> {
		await this.ctx.add({ role: 'user', content: prompt });
		logger.info({ prompt, tools: this.tools.map((t) => t.definition.name) }, 'agent run started');

		let iterations = 0;

		while (iterations < MAX_ITERATIONS) {
			iterations++;
			logger.debug({ iteration: iterations }, 'agent iteration');

			const response = await this.provider.chat(this.ctx.build(), this.tools);

			const hasToolCalls = response.toolCalls !== undefined && response.toolCalls.length > 0;
			if (response.content || hasToolCalls) {
				await this.ctx.add({
					role: 'assistant',
					content: response.content,
					toolCalls: response.toolCalls
				});
			} else {
				await this.ctx.add({
					role: 'system',
					content: 'Provided no response, and called no tools. Retry.'
				});
			}
			logger.debug({ content: response.content, toolCalls: response.toolCalls }, 'model response');

			if (response.toolCalls !== undefined) {
				for (const toolCall of response.toolCalls ?? []) {
					logger.info({ tool: toolCall.name, args: toolCall.args }, 'tool call');
					const tool = this.tools.find((t) => t.definition.name === toolCall.name);
					if (tool) {
						let result = '';
						try {
							result = await tool.execute(toolCall.args);
							logger.debug({ tool: toolCall.name, result }, 'tool result');
						} catch (e) {
							if (e instanceof ToolError) {
								result = e.message;
							} else {
								result = JSON.stringify(e);
							}
							logger.error({ tool: toolCall.name, error: result }, 'tool error');
						} finally {
							const toolMessage: Message = {
								role: 'tool',
								content: result,
								toolName: toolCall.name
							};
							await this.ctx.add(toolMessage);
						}
					} else {
						logger.warn({ tool: toolCall.name }, 'tool not found');
					}
				}
				continue;
			}

			logger.info('agent run completed');
			return response.content;
		}

		logger.warn({ maxIterations: MAX_ITERATIONS }, 'max iterations reached');
		return 'Maximum iterations reached without completing task';
	}
}
