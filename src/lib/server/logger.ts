import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
	level: process.env.LOG_LEVEL ?? 'info',
	// Log errors under the `err` key: this serializer includes the stack and the `cause` chain —
	// ModelProviderError keeps the original SDK error (status, response body) as its cause.
	serializers: { err: pino.stdSerializers.errWithCause },
	transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined
});
