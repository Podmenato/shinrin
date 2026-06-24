import type { Tool } from './tool';
import { CurrentTimeTool } from './currentTimeTool';
import { GetDecksTool } from './anki/getDecksTool';
import { AddNoteTool } from './anki/addNoteTool';
import { AddSentenceNoteTool } from './anki/addSentenceNoteTool';
import { FindTool } from './anki/findTool';
import { GetModelsTool } from './anki/getModelsTool';
import { GetNoteInfoTool } from './anki/getNoteInfo';
import { CardsInfoTool } from './anki/cardsInfoTool';
import { GetIntervalsTool } from './anki/getIntervalsTool';
import { SaveMemoryTool } from './saveMemoryTool';
import { DeleteMemoryTool } from './deleteMemoryTool';
import { UpdateTopicProgressTool } from './updateTopicProgressTool';
import { LogMistakeTool } from './logMistakeTool';

export type ToolContext = { agentId: string };

const registry: Record<string, Tool> = {
	current_time_tool: new CurrentTimeTool(),
	get_decks: new GetDecksTool(),
	add_note: new AddNoteTool(),
	add_sentence_note: new AddSentenceNoteTool(),
	find: new FindTool(),
	get_note_types: new GetModelsTool(),
	get_note_info: new GetNoteInfoTool(),
	cards_info: new CardsInfoTool(),
	get_intervals: new GetIntervalsTool()
};

const contextualRegistry: Record<string, (ctx: ToolContext) => Tool> = {
	save_memory: (ctx) => new SaveMemoryTool(ctx.agentId),
	delete_memory: (ctx) => new DeleteMemoryTool(ctx.agentId),
	update_topic_progress: (ctx) => new UpdateTopicProgressTool(ctx.agentId),
	log_mistake: (ctx) => new LogMistakeTool(ctx.agentId)
};

export function getTools(names: string[], ctx: ToolContext): Tool[] {
	return names.map((name) => {
		if (name in contextualRegistry) {
			return contextualRegistry[name](ctx);
		}
		const tool = registry[name];
		if (!tool) {
			throw new Error(`Unknown tool: ${name}`);
		}
		return tool;
	});
}
