import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './parser';

// File generated 100% by Claude, I didn't review it at all
// Review closely if causes problems

describe('parseInline', () => {
	it('parses plain text as a single text node', () => {
		expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
	});

	it('parses bold, italic, strikethrough, and inline code', () => {
		expect(parseInline('**bold** and *italic* and ~~strike~~ and `code`')).toEqual([
			{ type: 'bold', value: 'bold' },
			{ type: 'text', value: ' and ' },
			{ type: 'italic', value: 'italic' },
			{ type: 'text', value: ' and ' },
			{ type: 'strike', value: 'strike' },
			{ type: 'text', value: ' and ' },
			{ type: 'code', value: 'code' }
		]);
	});

	it('parses links with safe urls', () => {
		expect(parseInline('see [docs](https://example.com)')).toEqual([
			{ type: 'text', value: 'see ' },
			{ type: 'link', href: 'https://example.com', text: 'docs' }
		]);
	});

	it('falls back to literal text for unsafe urls', () => {
		expect(parseInline('see [danger](javascript:alert(1))')).toEqual([
			{ type: 'text', value: 'see [danger](javascript:alert(1))' }
		]);
	});

	it('never interprets raw markup — only ever produces plain text nodes for it', () => {
		expect(parseInline('<script>alert(1)</script>')).toEqual([
			{ type: 'text', value: '<script>alert(1)</script>' }
		]);
	});

	it('does not treat a stray unmatched * as an emphasis opener', () => {
		// A space immediately after the `*` fails the flanking-delimiter rule, so this must not
		// greedily pair with some unrelated `*` much later in the same paragraph.
		expect(parseInline('essay (reflection). * A monologue demands drama, *and so on.')).toEqual([
			{ type: 'text', value: 'essay (reflection). * A monologue demands drama, *and so on.' }
		]);
	});

	it('still parses tightly-wrapped emphasis next to punctuation', () => {
		expect(parseInline('say *hello* now')).toEqual([
			{ type: 'text', value: 'say ' },
			{ type: 'italic', value: 'hello' },
			{ type: 'text', value: ' now' }
		]);
	});
});

describe('parseMarkdown', () => {
	it('parses headings', () => {
		expect(parseMarkdown('# Title')).toEqual([
			{ type: 'heading', level: 1, children: [{ type: 'text', value: 'Title' }] }
		]);
	});

	it('joins wrapped lines into a single paragraph', () => {
		expect(parseMarkdown('hello\nworld')).toEqual([
			{ type: 'paragraph', children: [{ type: 'text', value: 'hello world' }] }
		]);
	});

	it('parses fenced code blocks with a language', () => {
		expect(parseMarkdown('```ts\nconst a = 1;\n```')).toEqual([
			{ type: 'codeblock', lang: 'ts', code: 'const a = 1;' }
		]);
	});

	it('parses unordered lists', () => {
		expect(parseMarkdown('- one\n- two')).toEqual([
			{
				type: 'list',
				ordered: false,
				items: [[{ type: 'text', value: 'one' }], [{ type: 'text', value: 'two' }]]
			}
		]);
	});

	it('parses blockquotes', () => {
		expect(parseMarkdown('> quoted')).toEqual([
			{ type: 'blockquote', children: [{ type: 'text', value: 'quoted' }] }
		]);
	});

	it('parses tables', () => {
		expect(parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')).toEqual([
			{
				type: 'table',
				headers: [[{ type: 'text', value: 'a' }], [{ type: 'text', value: 'b' }]],
				rows: [[[{ type: 'text', value: '1' }], [{ type: 'text', value: '2' }]]]
			}
		]);
	});

	it('parses horizontal rules written as ***, ---, or ___', () => {
		expect(parseMarkdown('above\n\n***\n\nbelow')).toEqual([
			{ type: 'paragraph', children: [{ type: 'text', value: 'above' }] },
			{ type: 'hr' },
			{ type: 'paragraph', children: [{ type: 'text', value: 'below' }] }
		]);
		expect(parseMarkdown('---')).toEqual([{ type: 'hr' }]);
		expect(parseMarkdown('___')).toEqual([{ type: 'hr' }]);
	});

	it('does not mistake a spaced-out break for a list item', () => {
		expect(parseMarkdown('* * *')).toEqual([{ type: 'hr' }]);
	});
});
