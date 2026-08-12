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
      <main className="configuration-error">
        <h1>Studio configuration required</h1>
        <p>NEXT_PUBLIC_CONVEX_URL is missing.</p>
      </main>
    );
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <TooltipProvider>{children}</TooltipProvider>
    </ConvexProviderWithClerk>
  );
}
