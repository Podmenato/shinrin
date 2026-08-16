import pino from 'pino';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createDb } from '../src/lib/server/db/createDb';
import { currentMode, dbPath } from '../src/lib/server/env';
import { registerSaveStoryMcpTool } from '../src/lib/server/mcp/tools/saveStoryMcpTool';

// stdout is the JSON-RPC wire for this process — nothing but the transport
// may write to it, so logs go to stderr (fd 2) instead of the pino default.
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, pino.destination(2));

const db = createDb(dbPath(currentMode()));

const server = new McpServer(
	{ name: 'shinrin', version: '0.0.1' },
	{ capabilities: { tools: {} } }
);

await registerSaveStoryMcpTool(server, db);

const transport = new StdioServerTransport();
await server.connect(transport);

logger.info('shinrin MCP server connected over stdio');
