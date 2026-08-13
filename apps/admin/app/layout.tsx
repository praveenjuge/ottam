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
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <ClerkProvider afterSignOutUrl="/" dynamic>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
