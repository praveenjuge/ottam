const clerkIssuer = process.env.CLERK_FRONTEND_API_URL;

if (!clerkIssuer) {
  throw new Error(
    "CLERK_FRONTEND_API_URL is required to validate Clerk session tokens",
  );
}

export default {
  providers: [
    {
      applicationID: "convex",
      domain: clerkIssuer,
    },
  ],
};
