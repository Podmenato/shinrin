import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	localhostAllowedOrigins,
	McpServer,
	originValidationResponse
} from '@modelcontextprotocol/server';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db/index.js';
import { registerSaveStoryMcpTool } from '#lib/server/mcp/tools/saveStoryMcpTool.js';

// The factory runs once per HTTP request, so each request gets a fresh server — which also means
// save_story's `subject` enum is rebuilt from the current `subjects` table every time.
const mcp = createMcpHandler(async () => {
	const server = new McpServer(
		{ name: 'shinrin', version: __APP_VERSION__ },
		{ capabilities: { tools: {} } }
	);
	await registerSaveStoryMcpTool(server, db);
	return server;
});

// MCP clients run on the same machine, so only localhost Host/Origin headers are accepted — the
// SDK's documented DNS-rebinding protection (a web page can't make a browser reach this endpoint
// under another hostname). Non-browser clients send no Origin, which passes. This doesn't stop a
// device on the LAN that sets the headers itself — the same exposure as the rest of this auth-less
// app.
const handle: RequestHandler = async ({ request }) =>
	hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
	originValidationResponse(request, localhostAllowedOrigins()) ??
	mcp.fetch(request);

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
