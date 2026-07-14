// File generated 100% by Claude, I didn't review it at all
// Replace with a library if causes problems

export type InlineNode =
	| { type: 'text'; value: string }
	| { type: 'bold'; value: string }
	| { type: 'italic'; value: string }
	| { type: 'strike'; value: string }
	| { type: 'code'; value: string }
	| { type: 'link'; href: string; text: string };

export type BlockNode =
	| { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
	| { type: 'paragraph'; children: InlineNode[] }
	| { type: 'codeblock'; lang?: string; code: string }
	| { type: 'blockquote'; children: InlineNode[] }
	| { type: 'list'; ordered: boolean; items: InlineNode[][] }
	| { type: 'table'; headers: InlineNode[][]; rows: InlineNode[][][] }
	| { type: 'hr' };

function isSafeUrl(url: string): boolean {
	return /^(https?:|mailto:|\/|#)/i.test(url.trim());
}

function splitTableRow(line: string): string[] {
	let trimmed = line.trim();
	if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
	if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
	return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparatorRow(line: string): boolean {
	if (!line.includes('|') && !line.includes('-')) return false;
	const cells = splitTableRow(line);
	return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

const LATEX_SYMBOLS: Record<string, string> = {
	'\\rightarrow': '→',
	'\\to': '→',
	'\\leftarrow': '←',
	'\\leftrightarrow': '↔',
	'\\Rightarrow': '⇒',
	'\\Leftarrow': '⇐',
	'\\Leftrightarrow': '⇔',
	'\\times': '×',
	'\\cdot': '·',
	'\\div': '÷',
	'\\pm': '±',
	'\\le': '≤',
	'\\leq': '≤',
	'\\ge': '≥',
	'\\geq': '≥',
	'\\neq': '≠',
	'\\approx': '≈',
	'\\infty': '∞',
	'\\sum': '∑',
	'\\prod': '∏',
	'\\sqrt': '√',
	'\\in': '∈',
	'\\notin': '∉',
	'\\subset': '⊂',
	'\\cup': '∪',
	'\\cap': '∩',
	'\\forall': '∀',
	'\\exists': '∃',
	'\\emptyset': '∅',
	'\\ldots': '…',
	'\\cdots': '⋯',
	'\\alpha': 'α',
	'\\beta': 'β',
	'\\gamma': 'γ',
	'\\delta': 'δ',
	'\\epsilon': 'ε',
	'\\theta': 'θ',
	'\\lambda': 'λ',
	'\\mu': 'μ',
	'\\pi': 'π',
	'\\sigma': 'σ',
	'\\omega': 'ω'
};

const LATEX_COMMAND_PATTERN = new RegExp(
	Object.keys(LATEX_SYMBOLS)
		.sort((a, b) => b.length - a.length)
		.map((command) => command.replace(/\\/g, '\\\\'))
		.join('|') + '(?![a-zA-Z])',
	'g'
);

function renderMathSymbols(text: string): string {
	return text.replace(/\$([^$\n]+)\$/g, (_match, inner) => {
		const substituted = (inner as string).replace(
			LATEX_COMMAND_PATTERN,
			(command) => LATEX_SYMBOLS[command]
		);
		return substituted.replace(/\\[a-zA-Z]+/g, '').trim();
	});
}

// Order matters: code before links/emphasis (so its contents aren't reprocessed), bold before
// italic (so `**x**` isn't parsed as two italics), at each scan position the first alternative
// that matches wins. Content groups require a non-whitespace char immediately inside each
// delimiter pair (CommonMark's flanking-delimiter rule) so a stray, unmatched `*` — e.g. a lone
// bullet-like fragment mid-sentence — can't get greedily paired with an unrelated `*` much later
// in the same paragraph and wrap everything in between in emphasis.
const INLINE_PATTERN =
	/`([^`]+)`|\[([^\]]+)]\(([^)\s]+)\)|\*\*(\S(?:[^*]*\S)?)\*\*|__(\S(?:[^_]*\S)?)__|~~(\S(?:[^~]*\S)?)~~|(?<![*\w])\*(\S(?:[^*\n]*\S)?)\*(?!\*)|(?<![_\w])_(\S(?:[^_\n]*\S)?)_(?!_)/g;

/** Tokenizes a constrained inline markdown subset into plain data nodes — never produces HTML. */
export function parseInline(text: string): InlineNode[] {
	const source = renderMathSymbols(text);
	const nodes: InlineNode[] = [];
	let lastIndex = 0;

	for (const match of source.matchAll(INLINE_PATTERN)) {
		const [
			full,
			code,
			linkText,
			linkUrl,
			boldStar,
			boldUnderscore,
			strike,
			italicStar,
			italicUnderscore
		] = match;
		const index = match.index ?? 0;

		if (linkText !== undefined && linkUrl !== undefined && !isSafeUrl(linkUrl)) {
			continue;
		}

		if (index > lastIndex) {
			nodes.push({ type: 'text', value: source.slice(lastIndex, index) });
		}

		if (code !== undefined) {
			nodes.push({ type: 'code', value: code });
		} else if (linkText !== undefined && linkUrl !== undefined) {
			nodes.push({ type: 'link', href: linkUrl, text: linkText });
		} else if (boldStar !== undefined || boldUnderscore !== undefined) {
			nodes.push({ type: 'bold', value: (boldStar ?? boldUnderscore)! });
		} else if (strike !== undefined) {
			nodes.push({ type: 'strike', value: strike });
		} else if (italicStar !== undefined || italicUnderscore !== undefined) {
			nodes.push({ type: 'italic', value: (italicStar ?? italicUnderscore)! });
		}

		lastIndex = index + full.length;
	}

	if (lastIndex < source.length) {
		nodes.push({ type: 'text', value: source.slice(lastIndex) });
	}

	return nodes;
}

/** Parses a constrained markdown subset (headers, emphasis, code, links, lists, blockquotes, tables) into block nodes. */
export function parseMarkdown(source: string): BlockNode[] {
	const codeBlocks: { lang?: string; code: string }[] = [];
	const withPlaceholders = source.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
		const index = codeBlocks.length;
		codeBlocks.push({ lang: lang || undefined, code: (code as string).trimEnd() });
		return ` ${index} `;
	});

	const lines = withPlaceholders.split('\n');
	const blocks: BlockNode[] = [];
	let listType: 'ul' | 'ol' | null = null;
	let listItems: InlineNode[][] = [];
	let paragraphLines: string[] = [];

	function flushParagraph() {
		if (paragraphLines.length) {
			blocks.push({ type: 'paragraph', children: parseInline(paragraphLines.join(' ')) });
			paragraphLines = [];
		}
	}

	function flushList() {
		if (listType) {
			blocks.push({ type: 'list', ordered: listType === 'ol', items: listItems });
			listType = null;
			listItems = [];
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];

		if (rawLine.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
			flushParagraph();
			flushList();
			const headers = splitTableRow(rawLine).map((cell) => parseInline(cell));
			const rows: InlineNode[][][] = [];
			i += 2;
			while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
				rows.push(splitTableRow(lines[i]).map((cell) => parseInline(cell)));
				i++;
			}
			blocks.push({ type: 'table', headers, rows });
			i--;
			continue;
		}

		// Checked before list detection: a spaced-out break like "* * *" would otherwise also
		// match the unordered-list regex below.
		if (/^([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(rawLine.trim())) {
			flushParagraph();
			flushList();
			blocks.push({ type: 'hr' });
			continue;
		}

		const placeholderMatch = rawLine.match(/^ (\d+) $/);
		if (placeholderMatch) {
			flushParagraph();
			flushList();
			const block = codeBlocks[Number(placeholderMatch[1])];
			blocks.push({ type: 'codeblock', lang: block.lang, code: block.code });
			continue;
		}

		const headerMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
		if (headerMatch) {
			flushParagraph();
			flushList();
			blocks.push({
				type: 'heading',
				level: headerMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
				children: parseInline(headerMatch[2])
			});
			continue;
		}

		const quoteMatch = rawLine.match(/^>\s?(.*)$/);
		if (quoteMatch) {
			flushParagraph();
			flushList();
			blocks.push({ type: 'blockquote', children: parseInline(quoteMatch[1]) });
			continue;
		}

		const unorderedMatch = rawLine.match(/^[-*]\s+(.*)$/);
		const orderedMatch = rawLine.match(/^\d+\.\s+(.*)$/);
		if (unorderedMatch || orderedMatch) {
			flushParagraph();
			const wantedType = unorderedMatch ? 'ul' : 'ol';
			if (listType !== wantedType) {
				flushList();
				listType = wantedType;
			}
			listItems.push(parseInline((unorderedMatch ?? orderedMatch)![1]));
			continue;
		}

		if (rawLine.trim() === '') {
			flushParagraph();
			flushList();
			continue;
		}

		paragraphLines.push(rawLine.trim());
	}

	flushParagraph();
	flushList();

	return blocks;
}
