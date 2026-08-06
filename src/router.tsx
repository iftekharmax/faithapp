import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Disable automatic re-fetching to persist UI state across tab switches
        // and avoid triggering loading states or reloads unexpectedly.
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch route code/data on hover-or-focus so navigation feels instant.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPreloadDelay: 50,
  });

  return router;
};

