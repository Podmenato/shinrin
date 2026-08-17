import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';
import { db } from '../db/index';
import { stories, storyContent } from '../db/schema';
import { eq } from 'drizzle-orm';
import { toJsonObjectSchema, type JsonValue } from '#lib/json.js';

const VALID_MODES = ['create', 'update'] as const;

type ValidatedArgs =
	| { mode: 'create'; title: string; content: string | undefined }
	| { mode: 'update'; id: string; content: string };

export class SaveStoryTool implements Tool {
	definition: ToolDefinition;
	private subjectId: string | null;

	constructor(subjectId: string | null) {
		this.subjectId = subjectId;
		this.definition = {
			name: 'save_story',
			description:
				"Save a story's content in your own subject/language. " +
				"mode 'create' starts a brand-new story — title required, content optional (a story can exist " +
				'with no content yet, e.g. before attaching resources). ' +
				"mode 'update' saves your subject's content on an existing story, identified by id — " +
				'overwrites whatever your subject already had for it (e.g. a better-written version or a ' +
				'fresh translation), it does not create a duplicate.',
			parameters: toJsonObjectSchema({
				mode: {
					type: 'string',
					description:
						"'create' starts a brand-new story. 'update' saves your subject's content on an " +
						'existing story, identified by id.',
					enum: [...VALID_MODES]
				},
				title: {
					type: 'string',
					description: "The story's title. Required when mode is 'create', ignored otherwise.",
					optional: true
				},
				id: {
					type: 'string',
					description: "The id of the existing story. Required when mode is 'update'.",
					optional: true
				},
				content: {
					type: 'string',
					description:
						"The story's content, written in your own subject/language. Required when mode is " +
						"'update'; optional when mode is 'create'.",
					optional: true
				}
			})
		};
	}

	async execute(args: Record<string, JsonValue>): Promise<string> {
		const validated = this.validateArgs(args);

		if (validated.mode === 'create') {
			const { title, content } = validated;
			const [story] = await db.insert(stories).values({ title }).returning();
			if (content) {
				await db
					.insert(storyContent)
					.values({ storyId: story.id, subjectId: this.subjectId!, content });
			}
			return content ? `Story created: "${title}"` : `Story created (no content yet): "${title}"`;
		}

		const { id, content } = validated;
		const [story] = await db.select().from(stories).where(eq(stories.id, id));
		if (!story) {
			throw new ToolError(`No story found with id "${id}".`);
		}

		await db
			.insert(storyContent)
			.values({ storyId: id, subjectId: this.subjectId!, content })
			.onConflictDoUpdate({
				target: [storyContent.storyId, storyContent.subjectId],
				set: { content, stale: false, updatedAt: new Date() }
			});

		return `Story content saved: "${story.title}"`;
	}

	private validateArgs(args: Record<string, JsonValue>): ValidatedArgs {
		const mode = args.mode as string;
		if (!VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
			throw new ToolError(`mode must be one of: ${VALID_MODES.join(', ')}.`);
		}

		const content = args.content as string | undefined;
		if (content && !this.subjectId) {
			throw new ToolError('This agent has no subject, so it cannot save story content.');
		}

		if (mode === 'create') {
			const title = args.title as string | undefined;
			if (!title) {
				throw new ToolError("title is required when mode is 'create'.");
			}
			return { mode: 'create', title, content };
		}

		const id = args.id as string | undefined;
		if (!id) {
			throw new ToolError("id is required when mode is 'update'.");
		}
		if (!content) {
			throw new ToolError("content is required when mode is 'update'.");
		}
		return { mode: 'update', id, content };
	}
}
