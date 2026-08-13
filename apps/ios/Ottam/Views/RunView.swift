import ClerkKit
import SwiftData
import SwiftUI

struct RunView: View {
  @Environment(AppServices.self) private var services
  @Environment(Clerk.self) private var clerk
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var modelContext
  let bundleData: Data
  let durationMinutes: Int
  let episode: CatalogEpisode
  @State private var controller = RunSessionController()
  @State private var errorMessage: String?
  @State private var run: RunSessionRecord?
  @State private var savedRun = false
  @ScaledMetric(relativeTo: .largeTitle) private var timerSize = 58.0

  private var movementLabel: String {
    controller.isPaused ? "PAUSED" : controller.movement.rawValue.uppercased()
  }

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [.black, .orange.opacity(0.45), .black],
        startPoint: .topLeading,
        endPoint: .bottomTrailing,
      )
      VStack(spacing: 28) {
        HStack {
          Button("Close", systemImage: "xmark") { dismiss() }
            .labelStyle(.iconOnly)
            .accessibilityLabel("Close episode")
            .buttonStyle(.bordered)
          Spacer()
          Text(movementLabel)
            .font(.caption.weight(.bold))
            .tracking(1.5)
            .foregroundStyle(controller.movement == .running ? .orange : .white)
        }
        Spacer()
        VStack(spacing: 8) {
          Text(episode.title)
            .font(.title2.weight(.semibold))
            .multilineTextAlignment(.center)
          Text(time(controller.remainingSeconds))
            .font(.system(size: timerSize, weight: .light, design: .rounded))
            .dynamicTypeSize(...DynamicTypeSize.accessibility3)
            .monospacedDigit()
            .accessibilityLabel("\(controller.remainingSeconds) seconds remaining")
        }
        ProgressView(value: controller.progressFraction)
          .tint(.orange)
        if controller.movement == .stationary, !controller.isPaused {
          Label("Move when you’re ready. The story is waiting.", systemImage: "pause.circle")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        if let errorMessage {
          Text(errorMessage).foregroundStyle(.red)
            .accessibilityAddTraits(.isStaticText)
        }
        Spacer()
        Button {
          controller.togglePause()
        } label: {
          Label(
            controller.isPaused ? "Resume" : "Pause",
            systemImage: controller.isPaused ? "play.fill" : "pause.fill",
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .tint(.orange)
      }
      .padding(24)
    }
    .foregroundStyle(.white)
    .ignoresSafeArea()
    .task { start() }
    .onChange(of: controller.isComplete) { _, complete in
      if complete {
        finishRun(completed: true)
      }
    }
    .onDisappear {
      controller.stop()
      finishRun(completed: controller.isComplete)
    }
    .sheet(isPresented: Binding(
      get: { controller.isComplete },
      set: {
        if !$0 {
          dismiss()
        }
      },
    )) {
      CompletionView(run: run, title: episode.title) { dismiss() }
    }
  }

  private func start() {
    do {
      let bundle = try JSONDecoder().decode(EpisodeReleaseBundle.self, from: bundleData)
      guard let plan = bundle.plan(minutes: durationMinutes) else {
        throw DownloadError.invalidManifest
      }
      let descriptor = FetchDescriptor<EpisodeProgressRecord>(
        predicate: #Predicate { $0.episodeId == episode.episodeId },
      )
      let existing = try modelContext.fetch(descriptor).first
      let resume = existing?.planHash == plan.planHash ? existing : nil
      let run = RunSessionRecord(
        episodeId: episode.episodeId,
        releaseId: episode.releaseId,
        planHash: plan.planHash,
        startedAt: .now,
      )
      modelContext.insert(run)
      self.run = run
      controller.onProgress = { sceneIndex, position, completed in
        saveProgress(
          plan: plan,
          sceneIndex: sceneIndex,
          position: position,
          completed: completed,
        )
      }
      try controller.start(
        plan: plan,
        segmentIndex: resume?.sceneIndex ?? 0,
        positionMilliseconds: resume?.positionMilliseconds ?? 0,
        assetResolver: { key in
          try services.downloads.localAudioURL(releaseId: episode.releaseId, key: key)
        },
      )
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func saveProgress(
    plan: PlaybackPlan,
    sceneIndex: Int,
    position: Int,
    completed: Bool,
  ) {
    let descriptor = FetchDescriptor<EpisodeProgressRecord>(
      predicate: #Predicate { $0.episodeId == episode.episodeId },
    )
    let progress = (try? modelContext.fetch(descriptor).first)
      ?? EpisodeProgressRecord(
        episodeId: episode.episodeId,
        releaseId: episode.releaseId,
        durationMinutes: durationMinutes,
        planHash: plan.planHash,
      )
    if progress.modelContext == nil {
      modelContext.insert(progress)
    }
    progress.clientSequence += 1
    progress.durationMinutes = durationMinutes
    progress.planHash = plan.planHash
    progress.positionMilliseconds = position
    progress.releaseId = episode.releaseId
    progress.sceneIndex = sceneIndex
    progress.updatedAt = .now
    if completed {
      progress.completedAt = .now
    }
    try? modelContext.save()
  }

  private func finishRun(completed: Bool) {
    guard !savedRun, let run else { return }
    savedRun = true
    run.activeMilliseconds = controller.totalActiveMilliseconds
    run.completed = completed
    run.distanceMeters = controller.motion.distanceMeters
    run.endedAt = .now
    run.runningSamples = controller.motion.runningSamples
    run.stationarySamples = controller.motion.stationarySamples
    run.steps = controller.motion.steps
    run.walkingSamples = controller.motion.walkingSamples
    try? modelContext.save()
    if clerk.user != nil {
      let descriptor = FetchDescriptor<EpisodeProgressRecord>(
        predicate: #Predicate { $0.episodeId == episode.episodeId },
      )
      if let progress = try? modelContext.fetch(descriptor).first {
        Task {
          try? await ProgressSyncService(client: services.convex)
            .sync(progress: progress, run: run, in: modelContext)
        }
      }
    }
  }

  private func time(_ seconds: Int) -> String {
    String(format: "%02d:%02d", seconds / 60, seconds % 60)
  }
}

private struct CompletionView: View {
  let run: RunSessionRecord?
  let title: String
  let done: () -> Void

  var body: some View {
    VStack(spacing: 24) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 64))
        .foregroundStyle(.orange)
        .accessibilityHidden(true)
      Text("Episode complete").font(.title.weight(.bold))
      Text(title).foregroundStyle(.secondary)
      if let run {
        HStack(spacing: 28) {
          stat("Time", "\(run.activeMilliseconds / 60000) min")
          stat("Distance", String(format: "%.1f km", (run.distanceMeters ?? 0) / 1000))
          stat("Steps", "\(run.steps ?? 0)")
        }
      }
      Button("Done", action: done)
        .buttonStyle(.borderedProminent)
        .tint(.orange)
    }
    .padding(28)
    .presentationDetents([.medium])
  }

  private func stat(_ label: String, _ value: String) -> some View {
    VStack {
      Text(value).font(.headline).monospacedDigit()
      Text(label).font(.caption).foregroundStyle(.secondary)
    }
  }
}
