// File generated 100% by Claude, I didn't review it at all
// Replace with a library if causes problems

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

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

function renderInline(text: string): string {
	let html = escapeHtml(renderMathSymbols(text));

	// inline code (before other inline rules so contents aren't reprocessed)
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

	// links: [text](url)
	html = html.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (match, label, url) => {
		return isSafeUrl(url)
			? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
			: match;
	});

	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
	html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
	html = html.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
	html = html.replace(/(?<![_\w])_([^_\n]+)_(?!_)/g, '<em>$1</em>');

	return html;
}

/** Renders a constrained markdown subset (headers, emphasis, code, links, lists, blockquotes, tables) to sanitized HTML. */
export function renderMarkdown(source: string): string {
	const codeBlocks: string[] = [];
	const withPlaceholders = source.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
		const index = codeBlocks.length;
		codeBlocks.push(
			`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code.trimEnd())}</code></pre>`
		);
		return ` ${index} `;
	});

	const lines = withPlaceholders.split('\n');
	const out: string[] = [];
	let listType: 'ul' | 'ol' | null = null;
	let paragraph: string[] = [];

	function flushParagraph() {
		if (paragraph.length) {
			out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
			paragraph = [];
		}
	}

	function closeList() {
		if (listType) {
			out.push(`</${listType}>`);
			listType = null;
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];

		if (rawLine.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
			flushParagraph();
			closeList();
			const headerCells = splitTableRow(rawLine);
			out.push(
				'<table><thead><tr>' +
					headerCells.map((cell) => `<th>${renderInline(cell)}</th>`).join('') +
					'</tr></thead><tbody>'
			);
			i += 2;
			while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
				const rowCells = splitTableRow(lines[i]);
				out.push(
					'<tr>' + rowCells.map((cell) => `<td>${renderInline(cell)}</td>`).join('') + '</tr>'
				);
				i++;
			}
			out.push('</tbody></table>');
			i--;
			continue;
		}

		const placeholderMatch = rawLine.match(/^ (\d+) $/);
		if (placeholderMatch) {
			flushParagraph();
			closeList();
			out.push(codeBlocks[Number(placeholderMatch[1])]);
			continue;
		}

		const headerMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
		if (headerMatch) {
			flushParagraph();
			closeList();
			const level = headerMatch[1].length;
			out.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
			continue;
		}

		const quoteMatch = rawLine.match(/^>\s?(.*)$/);
		if (quoteMatch) {
			flushParagraph();
			closeList();
			out.push(`<blockquote>${renderInline(quoteMatch[1])}</blockquote>`);
			continue;
		}

		const unorderedMatch = rawLine.match(/^[-*]\s+(.*)$/);
		const orderedMatch = rawLine.match(/^\d+\.\s+(.*)$/);
		if (unorderedMatch || orderedMatch) {
			flushParagraph();
			const wantedType = unorderedMatch ? 'ul' : 'ol';
			if (listType !== wantedType) {
				closeList();
				out.push(`<${wantedType}>`);
				listType = wantedType;
			}
			out.push(`<li>${renderInline((unorderedMatch ?? orderedMatch)![1])}</li>`);
			continue;
		}

		if (rawLine.trim() === '') {
			flushParagraph();
			closeList();
			continue;
		}

		paragraph.push(rawLine.trim());
	}

	flushParagraph();
	closeList();

	return out.join('\n');
}
