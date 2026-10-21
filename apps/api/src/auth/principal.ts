import type { IncomingMessage } from 'node:http';

export type Principal = { sub: string; email: string };

export type AuthenticatedRequest = IncomingMessage & { principal?: Principal };
