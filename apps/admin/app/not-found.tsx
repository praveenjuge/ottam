import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6 text-sm">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          404 — Page not found
        </h1>
        <p className="mt-2 leading-6 text-muted-foreground">
          This page does not exist. You may have followed an outdated link or
          mistyped a URL. Use the links below to find your way.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold">Where to go next</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <Link href="/" className="underline underline-offset-4">
              Home
            </Link>{" "}
            — Ottam Studio
          </li>
          <li>
            <Link href="/sitemap.xml" className="underline underline-offset-4">
              Sitemap
            </Link>{" "}
            — all indexed pages
          </li>
          <li>
            <Link href="/robots.txt" className="underline underline-offset-4">
              robots.txt
            </Link>
          </li>
          <li>
            <Link href="/llms.txt" className="underline underline-offset-4">
              llms.txt
            </Link>{" "}
            — site index for agents
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Recovery for agents</h2>
        <pre className="mt-2 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5">
          {`# 404 — Not Found (ottam.praveenjuge.com)

This path does not exist.

Try:
- Home: https://ottam.praveenjuge.com/
- Sitemap: https://ottam.praveenjuge.com/sitemap.xml
- Site index: https://ottam.praveenjuge.com/llms.txt
- Robots: https://ottam.praveenjuge.com/robots.txt
`}
        </pre>
      </section>
    </main>
  );
}
