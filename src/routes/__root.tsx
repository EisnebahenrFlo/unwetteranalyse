import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/layout/AppShell";

function NotFoundComponent() {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <h1 className="text-5xl font-bold text-foreground">404</h1>
          <p className="mt-2 text-sm text-muted-foreground">Diese Seite gibt es nicht.</p>
        </div>
      </div>
    </AppShell>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Seite konnte nicht geladen werden</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Erneut versuchen
        </button>
      </div>
    </AppShell>
  );
}

interface LocationSearch {
  lat?: number;
  lon?: number;
  name?: string;
  country?: string;
  admin?: string;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  validateSearch: (search: Record<string, unknown>): LocationSearch => ({
    lat: search.lat != null ? Number(search.lat) : undefined,
    lon: search.lon != null ? Number(search.lon) : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    country: typeof search.country === "string" ? search.country : undefined,
    admin: typeof search.admin === "string" ? search.admin : undefined,
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Unwetteranaylse" },
      { name: "description", content: "Modernes, ruhiges Wetteranalysetool für DACH und Italien mit DWD-orientierter Warnlogik und Lernmodus." },
      { name: "author", content: "MeteoFlo" },
      { property: "og:title", content: "Unwetteranaylse" },
      { property: "og:description", content: "Modernes, ruhiges Wetteranalysetool für DACH und Italien mit DWD-orientierter Warnlogik und Lernmodus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Unwetteranaylse" },
      { name: "twitter:description", content: "Modernes, ruhiges Wetteranalysetool für DACH und Italien mit DWD-orientierter Warnlogik und Lernmodus." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/572413d7-7cb8-4494-a6db-6639780bb573/id-preview-8ca62a70--688bd4f4-bd88-4464-8502-8d052ff22d31.lovable.app-1781626592276.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/572413d7-7cb8-4494-a6db-6639780bb573/id-preview-8ca62a70--688bd4f4-bd88-4464-8502-8d052ff22d31.lovable.app-1781626592276.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
    </QueryClientProvider>
  );
}
