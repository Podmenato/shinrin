// Custom production server, replacing adapter-node's generated build/index.js.
// Wraps the same build/handler.js (a stable, non-hashed re-export adapter-node
// itself provides for exactly this) instead of running the generated
// entrypoint, to fix one thing: adapter-node assumes https whenever it can't
// otherwise detect the protocol, which never matches shinrin's plain-http
// traffic and makes every form/remote-function submission 403 ("Cross-site
// ... forbidden"). Forcing x-forwarded-proto: http here — hardcoded by us,
// never read from the client, so nothing to spoof — plus PROTOCOL_HEADER
// below fixes that origin check dynamically, for whatever address a client
// actually used (localhost, a LAN IP, a .local hostname). No ORIGIN pinning
// needed as a result, so a changing LAN IP is no longer a problem.
process.env.PROTOCOL_HEADER = 'x-forwarded-proto';

const { handler } = await import('../build/handler.js');
const { createServer } = await import('node:http');
const { shinrinPort } = await import('#lib/server/env.js');

const host = '0.0.0.0'; // same as adapter-node's own default
const port = Number(shinrinPort());

const server = createServer((req, res) => {
	req.headers['x-forwarded-proto'] = 'http';
	handler(req, res);
});

// Same graceful-shutdown behavior as adapter-node's own generated server —
// plain Node http.Server API, nothing adapter-internal about it.
const SHUTDOWN_TIMEOUT_MS = 30_000;
let shuttingDown = false;

function gracefulShutdown() {
	if (shuttingDown) return;
	shuttingDown = true;
	server.closeIdleConnections();
	server.close();
	setTimeout(() => server.closeAllConnections(), SHUTDOWN_TIMEOUT_MS);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen({ host, port }, () => {
	console.log(`Listening on http://${host}:${port}`);
});
