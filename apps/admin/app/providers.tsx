"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <main className="grid min-h-svh place-items-center p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold">
            Studio configuration required
          </h1>
          <p className="text-sm text-muted-foreground">
            NEXT_PUBLIC_CONVEX_URL is missing.
          </p>
        </div>
      </main>
    );
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <TooltipProvider>{children}</TooltipProvider>
    </ConvexProviderWithClerk>
  );
}
