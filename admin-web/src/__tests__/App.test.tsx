import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
) as jest.Mock;

test('loads cloud templates on mount', async () => {
  render(<App />);
  // Header should be present
  expect(screen.getByText(/雲端範本庫/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/api/templates?token=${import.meta.env.VITE_MASTER_TOKEN}`
    );
  });
});
