import Link from "next/link";
import { PUBLIC_ROUTES, SITE_HOST } from "./site-discovery";

const recoveryLinks = [
  { href: PUBLIC_ROUTES.home.path, label: "Home — Ottam Studio" },
  {
    href: PUBLIC_ROUTES.sitemap.path,
    label: "Sitemap — all indexed pages",
  },
  { href: PUBLIC_ROUTES.robots.path, label: "robots.txt" },
  {
    href: PUBLIC_ROUTES.llms.path,
    label: "llms.txt — site index for agents",
  },
] as const;

function RecoveryLinks() {
  return (
    <>
      <h2 className="text-sm font-semibold" id="recovery-links-heading">
        Where to go next
      </h2>
      <ul
        aria-labelledby="recovery-links-heading"
        className="-mt-4 list-inside list-disc space-y-1 text-muted-foreground"
      >
        {recoveryLinks.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="underline underline-offset-4">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function NotFound() {
  return (
    <main
      className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6 text-sm"
      id="main-content"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          404 — Page not found
        </h1>
        <p className="mt-2 leading-6 text-muted-foreground">
          This page does not exist. You may have followed an outdated link or
          mistyped a URL. Use the links below to find your way.
        </p>
      </div>

      <RecoveryLinks />

      <section>
        <h2 className="text-sm font-semibold">Recovery for agents</h2>
        <pre className="mt-2 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5">
          {`# 404 — Not Found (${SITE_HOST})

This path does not exist.

Try:
- Home: ${PUBLIC_ROUTES.home.url}
- Sitemap: ${PUBLIC_ROUTES.sitemap.url}
- Site index: ${PUBLIC_ROUTES.llms.url}
- Robots: ${PUBLIC_ROUTES.robots.url}
`}
        </pre>
      </section>
    </main>
  );
}
