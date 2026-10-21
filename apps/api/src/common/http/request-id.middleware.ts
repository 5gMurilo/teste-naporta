import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export type RequestWithId = IncomingMessage & { requestId?: string };

export function requestIdMiddleware(
  request: RequestWithId,
  response: ServerResponse,
  next: () => void,
): void {
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(request: RequestWithId): string | undefined {
  return request.requestId;
}
