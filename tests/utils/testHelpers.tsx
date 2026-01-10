import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a new QueryClient for each test
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: Infinity, // Don't garbage collect cache during tests
      },
      mutations: {
        retry: false,
      },
    },
  });

// Custom render with QueryClientProvider
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export const renderWithQueryClient = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { queryClient = createTestQueryClient(), ...renderOptions } =
    options || {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
};

// Wait for React Query to settle (all queries/mutations finished)
export const waitForQueryClientToSettle = async (queryClient: QueryClient) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  while (queryClient.isMutating() || queryClient.isFetching()) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

// Flush all pending promises (useful for async operations)
export const flushPromises = () =>
  new Promise((resolve) => setImmediate(resolve));
