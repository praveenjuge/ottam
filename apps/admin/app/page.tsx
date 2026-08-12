import { Show, SignIn } from "@clerk/nextjs";
import { StudioApp } from "@/components/studio/studio-app";

export default function HomePage() {
  return (
    <Show
      fallback={
        <main className="sign-in-shell">
          <SignIn routing="hash" />
        </main>
      }
      when="signed-in"
    >
      <StudioApp />
    </Show>
  );
}
