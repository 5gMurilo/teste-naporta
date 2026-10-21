import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GENERIC_MESSAGE } from '@/lib/error-message';
import { ApiError, NETWORK_ERROR_MESSAGE, NetworkError } from '@/lib/http-client';
import { AsyncState } from './async-state';

const content = <p>conteúdo</p>;

describe('AsyncState (U33, U35)', () => {
  it('shows only a polite loading status while loading, even if stale data or an error exists', () => {
    render(
      <AsyncState loading error={new Error('old')}>
        {content}
      </AsyncState>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    expect(screen.queryByText('conteúdo')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the empty message as a status without a retry button', () => {
    render(
      <AsyncState loading={false} empty emptyMessage="Nenhum pedido">
        {content}
      </AsyncState>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Nenhum pedido');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('conteúdo')).toBeNull();
  });

  it('renders the children when there is nothing to report', () => {
    render(<AsyncState loading={false}>{content}</AsyncState>);

    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces an API error with its safe detail and never as a success', () => {
    const error = new ApiError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      detail: 'O serviço está indisponível.',
      requestId: 'req-secret-id',
    });
    render(
      <AsyncState loading={false} error={error} onRetry={() => undefined}>
        {content}
      </AsyncState>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('O serviço está indisponível.');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('conteúdo')).toBeNull();
    expect(screen.getByRole('alert')).not.toHaveTextContent('req-secret-id');
  });

  it.each([
    ['a network failure', new NetworkError(), NETWORK_ERROR_MESSAGE],
    ['an unknown error', new Error('SELECT * FROM users; password=hunter2'), GENERIC_MESSAGE],
    ['a thrown string', 'boom with secrets', GENERIC_MESSAGE],
  ])('shows a safe message for %s and no raw text', (_name, error, expected) => {
    render(
      <AsyncState loading={false} error={error}>
        {content}
      </AsyncState>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).not.toHaveTextContent(/hunter2|SELECT|secrets/);
  });

  it('retries from the keyboard with Enter and Space', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <AsyncState loading={false} error={new NetworkError()} onRetry={onRetry}>
        {content}
      </AsyncState>,
    );

    await user.tab();
    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    expect(retry).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does not render a retry button when no retry action exists', () => {
    render(
      <AsyncState loading={false} error={new NetworkError()}>
        {content}
      </AsyncState>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
