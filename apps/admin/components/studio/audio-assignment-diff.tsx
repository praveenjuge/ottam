import type { AudioAssignment } from "@/lib/media/audio-assignment";

export function AudioAssignmentDiff({
  assignment,
}: {
  assignment: AudioAssignment;
}) {
  return (
    <section
      className="audio-proposal"
      aria-label="Audio assignment change set"
    >
      <div className="audio-cost">
        <span>Scene slot</span>
        <strong>{assignment.variant}</strong>
      </div>
      <dl>
        <div>
          <dt>Before</dt>
          <dd>{assignment.beforeAssetId ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>After</dt>
          <dd>{assignment.assetId}</dd>
        </div>
      </dl>
      <p>
        This candidate becomes the approved release audio for the selected scene
        slot. The prior object remains immutable.
      </p>
    </section>
  );
}
