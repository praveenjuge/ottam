import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { StudioApp } from "@/components/studio/studio-app";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <main className="sign-in-shell" id="main-content">
        <SignIn routing="hash" />
      </main>
    );
  }
  return <StudioApp />;
}
