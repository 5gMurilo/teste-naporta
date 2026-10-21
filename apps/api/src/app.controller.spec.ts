import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('returns Hello World!', () => {
    expect(new AppController().getHello()).toBe('Hello World!');
  });
});
