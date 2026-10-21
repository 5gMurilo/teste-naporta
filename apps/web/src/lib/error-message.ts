import { ApiError, NETWORK_ERROR_MESSAGE, NetworkError } from './http-client';

export const GENERIC_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

/** What the user reads for each error code of the API. The API's own English text is never shown. */
const MESSAGES_BY_CODE: Record<string, string> = {
  ORDER_NOT_FOUND: 'Pedido não encontrado.',
  ORDER_NUMBER_ALREADY_EXISTS: 'Já existe um pedido com este número.',
  VALIDATION_ERROR: 'Verifique os dados informados.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  SERVICE_UNAVAILABLE: 'O serviço está temporariamente indisponível. Tente novamente em instantes.',
};

/**
 * Text that is safe to show for any failure: a message written for a known API code, the network
 * message, or a generic one. Raw exception text, API details, and request ids are never used.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES_BY_CODE[error.code] ?? GENERIC_MESSAGE;
  if (error instanceof NetworkError) return NETWORK_ERROR_MESSAGE;
  return GENERIC_MESSAGE;
}
