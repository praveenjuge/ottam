import type { AudioAssignment } from "@/lib/media/audio-assignment";

export function AudioAssignmentDiff({
  assignment,
}: {
  assignment: AudioAssignment;
}) {
  return (
    <section
      className="grid gap-3 rounded-lg border bg-card p-4"
      aria-label="Audio assignment change set"
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-muted-foreground">Scene slot</span>
        <strong>{assignment.variant}</strong>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">Before</dt>
          <dd>{assignment.beforeAssetId ?? "Unassigned"}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">After</dt>
          <dd>{assignment.assetId}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        This candidate becomes the approved release audio for the selected scene
        slot. The prior object remains immutable.
      </p>
    </section>
  );
}
