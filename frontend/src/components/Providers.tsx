'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const memoizedClient = useMemo(() => queryClient, []);
  return (
    <QueryClientProvider client={memoizedClient}>{children}</QueryClientProvider>
  );
}
