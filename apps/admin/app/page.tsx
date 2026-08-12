import { studioFoundationMessage } from "./studio-foundation";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Ottam</p>
      <h1>{studioFoundationMessage}</h1>
      <p>The private, approval-gated episode workspace will live here.</p>
    </main>
  );
}
