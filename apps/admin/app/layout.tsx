import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import "./styles.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Ottam Studio",
  description: "Private production studio for Ottam episodes.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c0d0c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html className={cn("dark font-sans", geist.variable)} lang="en">
      <body className="min-w-80 overflow-x-hidden bg-background text-foreground antialiased">
        <a
          className="fixed top-3 left-3 z-100 -translate-y-24 rounded-lg bg-primary px-3 py-2 text-primary-foreground focus-visible:translate-y-0"
          href="#main-content"
        >
          Skip to main content
        </a>
        <ClerkProvider afterSignOutUrl="/" dynamic>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
