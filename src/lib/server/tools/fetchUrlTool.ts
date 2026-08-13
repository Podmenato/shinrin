import ky from 'ky';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { Tool, ToolDefinition } from './tool';
import { ToolError } from './tool';

// TODO: this module will most likely need massive optimization rework, to save context and eliminate
//  unnecessary text

// A generic desktop browser UA — some sites 403 requests carrying Node's default UA.
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const turndownService = new TurndownService();
// Dropping link and img tags to not tax context without unnecessary tokens
turndownService.addRule('stripLinkHrefs', {
	filter: 'a',
	replacement: (content) => content
});
turndownService.addRule('stripImages', {
	filter: 'img',
	replacement: () => ''
});

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

/**
 * Distinct http(s) URLs found in user-authored text, first-seen order. Never fed assistant or
 * tool-result text — the agent may only ever fetch a link a human actually pasted, not one it
 * (or a fetched page) constructed itself.
 */
export function extractUserUrls(userTexts: string[]): string[] {
	const found = userTexts.flatMap((text) => text.match(URL_PATTERN) ?? []);
	// Strip trailing punctuation a URL commonly picks up at the end of a sentence.
	const trimmed = found.map((url) => url.replace(/[.,;:!?)\]}]+$/, ''));
	return [...new Set(trimmed)].slice(0, 26);
}

function label(index: number): string {
	return String.fromCharCode(65 + index);
}

export class FetchUrlTool implements Tool {
	definition: ToolDefinition;
	private urlsByLabel: Map<string, string>;

	constructor(urls: string[]) {
		this.urlsByLabel = new Map(urls.map((url, i) => [label(i), url]));

		this.definition = {
			name: 'fetch_url',
			description:
				'Fetches one of the URLs the user pasted in this conversation and returns its main article ' +
				'content as Markdown (title, byline, content). Works well on static/server-rendered pages — ' +
				'Wikipedia, blogs, news articles. Does not execute JavaScript, so JS-rendered or paywalled ' +
				'pages may return empty or incomplete content.',
			parameters: [
				{
					name: 'url',
					type: 'string',
					required: true,
					enum: [...this.urlsByLabel.keys()],
					description:
						'Which pasted URL to fetch: ' +
						[...this.urlsByLabel.entries()].map(([l, u]) => `${l} = ${u}`).join(', ')
				}
			]
		};
	}

	async execute(args: Record<string, unknown>, signal: AbortSignal): Promise<string> {
		const chosen = args.url;
		const url = typeof chosen === 'string' ? this.urlsByLabel.get(chosen) : undefined;
		if (!url) {
			throw new ToolError(
				`"${chosen}" is not one of the available URLs (${[...this.urlsByLabel.keys()].join(', ')}).`
			);
		}

		const html = await ky
			.get(url, { signal, headers: { 'User-Agent': USER_AGENT } })
			.text()
			.catch((err: Error) => {
				throw new ToolError(`Failed to fetch ${url}: ${err.message}`);
			});

		const dom = new JSDOM(html, { url });
		const article = new Readability(dom.window.document).parse();

		if (!article || !article.content) {
			throw new ToolError(
				`Could not extract readable content from ${url} — it may not be a static article page.`
			);
		}

		return JSON.stringify({
			url,
			title: article.title,
			byline: article.byline,
			siteName: article.siteName,
			content: turndownService.turndown(article.content)
		});
	}
}
