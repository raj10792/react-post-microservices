import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn(),
    delete: jest.fn(),
  })),
}));

test('loads the Daybook feed', async () => {
  window.localStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: 'The good stuff' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'A fresh page' })).toBeInTheDocument();
});
