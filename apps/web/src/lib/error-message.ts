import { ApiError, NETWORK_ERROR_MESSAGE, NetworkError } from './http-client';

export const GENERIC_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

/**
 * Text that is safe to show for any failure. Only messages that the API itself marked as public
 * (Problem Details `detail`) or that this app wrote are used; arbitrary Error text never is.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError) return NETWORK_ERROR_MESSAGE;
  return GENERIC_MESSAGE;
}
