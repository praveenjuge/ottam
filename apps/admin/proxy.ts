import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  contentSecurityPolicy: {
    directives: {
      "base-uri": ["self"],
      "connect-src": [
        "https://*.convex.cloud",
        "https://*.convex.site",
        "wss://*.convex.cloud",
      ],
      "font-src": ["self"],
      "frame-ancestors": ["none"],
      "img-src": ["blob:", "data:"],
      "media-src": ["https://*.r2.cloudflarestorage.com"],
      "object-src": ["none"],
      "script-src-attr": ["none"],
    },
    strict: true,
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
