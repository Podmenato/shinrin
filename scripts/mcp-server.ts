import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import pino from 'pino';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as schema from '../src/lib/server/db/schema';
import { currentMode, loadEnv } from '../src/lib/server/env';
import { registerSaveStoryMcpTool } from '../src/lib/server/mcp/tools/saveStoryMcpTool';

loadEnv(currentMode());

// stdout is the JSON-RPC wire for this process — nothing but the transport
// may write to it, so logs go to stderr (fd 2) instead of the pino default.
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, pino.destination(2));

mkdirSync(dirname(process.env.DATABASE_URL!), { recursive: true });
const client = new Database(process.env.DATABASE_URL!);
client.pragma('journal_mode = WAL');
const db = drizzle(client, { schema });

const server = new McpServer(
	{ name: 'shinrin', version: '0.0.1' },
	{ capabilities: { tools: {} } }
);

await registerSaveStoryMcpTool(server, db);

const transport = new StdioServerTransport();
await server.connect(transport);

logger.info('shinrin MCP server connected over stdio');
