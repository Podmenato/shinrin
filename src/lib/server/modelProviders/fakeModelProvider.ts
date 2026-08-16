import type { ModelProvider, ModelResponse } from './modelProvider';
import type { Message } from '../contextManager';
import type { Tool } from '../tools/tool';

export type FakeResponder = ModelResponse[] | ((call: number, messages: Message[]) => ModelResponse);

/** A scripted ModelProvider for testing the Agent loop without a real Ollama daemon. */
export class FakeModelProvider implements ModelProvider {
	private responder: FakeResponder;
	private callCount = 0;
	/** Every `chat`/`chatStream` call the loop made, in order — for asserting on what the loop sent. */
	readonly calls: { messages: Message[]; tools: Tool[] }[] = [];

	constructor(responder: FakeResponder) {
		this.responder = responder;
	}

	async chat(messages: Message[], tools: Tool[], signal: AbortSignal): Promise<ModelResponse> {
		this.calls.push({ messages, tools });
		const call = this.callCount++;

		if (signal.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		const response = Array.isArray(this.responder) ? this.responder[call] : this.responder(call, messages);
		if (!response) {
			throw new Error(`FakeModelProvider: no response configured for call #${call}`);
		}
		return response;
	}

	async *chatStream(
		messages: Message[],
		tools: Tool[],
		signal: AbortSignal
	): AsyncGenerator<string, ModelResponse, void> {
		const response = await this.chat(messages, tools, signal);
		if (response.content) {
			yield response.content;
		}
		return response;
	}
}
