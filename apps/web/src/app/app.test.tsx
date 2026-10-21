import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App shell', () => {
  it('renders the brand and the orders heading in Portuguese', () => {
    render(<App />);

    expect(screen.getByText('naPorta')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument();
  });

  it('exposes banner and main landmarks for keyboard and screen reader navigation', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
