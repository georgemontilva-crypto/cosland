import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./lib/trpc";
import { ToastProvider } from "./components/ui";
import App from "./App";
import "./index.css";

function Root() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } }));
  return (
    <trpc.Provider client={trpcClient} queryClient={qc}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
