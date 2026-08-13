import Foundation
import Observation

@MainActor
@Observable
final class RunSessionController {
  private let audio = AudioPlaybackEngine()
  private var assetResolver: ((String) throws -> URL)?
  private var lastPersistedActiveMilliseconds = 0
  private var lastTick = ContinuousClock.now
  private var plan: PlaybackPlan?
  private var tickTask: Task<Void, Never>?
  private var wasStationary = true

  private(set) var isComplete = false
  private(set) var isPaused = false
  private(set) var segmentIndex = 0
  private(set) var segmentPositionMilliseconds = 0
  private(set) var totalActiveMilliseconds = 0
  let motion = MotionEngine()
  var onProgress: ((Int, Int, Bool) -> Void)?

  var movement: MovementState {
    motion.movement
  }

  var remainingSeconds: Int {
    guard let plan else { return 0 }
    let elapsedBefore = plan.segments.prefix(segmentIndex)
      .reduce(0) { $0 + $1.durationSeconds * 1000 }
    let elapsed = elapsedBefore + segmentPositionMilliseconds
    return max(0, (plan.targetSeconds * 1000 - elapsed) / 1000)
  }

  var progressFraction: Double {
    guard let plan, plan.targetSeconds > 0 else { return 0 }
    return 1 - Double(remainingSeconds) / Double(plan.targetSeconds)
  }

  func start(
    plan: PlaybackPlan,
    segmentIndex: Int = 0,
    positionMilliseconds: Int = 0,
    assetResolver: @escaping (String) throws -> URL,
  ) throws {
    self.plan = plan
    let resume = PlaybackTimeline.resume(
      plan: plan,
      segmentIndex: segmentIndex,
      positionMilliseconds: positionMilliseconds,
    )
    self.segmentIndex = resume.segmentIndex
    segmentPositionMilliseconds = resume.segmentPositionMilliseconds
    self.assetResolver = assetResolver
    isComplete = false
    isPaused = false
    motion.start()
    wasStationary = motion.movement == .stationary
    try enterCurrentSegment()
    if wasStationary {
      audio.pause()
    }
    lastTick = .now
    tickTask?.cancel()
    tickTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(for: .milliseconds(250))
        self?.tick()
      }
    }
  }

  func togglePause() {
    isPaused.toggle()
    if isPaused {
      audio.pause()
    } else if motion.movement != .stationary {
      resumeCurrentSegment()
      lastTick = .now
    }
    persist(force: true)
  }

  func stop() {
    tickTask?.cancel()
    tickTask = nil
    motion.stop()
    audio.stop()
    persist(force: true)
  }

  private func tick() {
    guard let plan, !isComplete else { return }
    let now = ContinuousClock.now
    let delta = lastTick.duration(to: now)
    lastTick = now
    let stationary = motion.movement == .stationary
    if isPaused || stationary {
      if stationary, !wasStationary {
        audio.pause()
      }
      wasStationary = stationary
      return
    }
    if wasStationary {
      resumeCurrentSegment()
    }
    wasStationary = false
    let milliseconds = max(
      0,
      Int(delta.components.seconds * 1000)
        + Int(delta.components.attoseconds / 1_000_000_000_000_000),
    )
    totalActiveMilliseconds += milliseconds
    let previousIndex = segmentIndex
    let advanced = PlaybackTimeline.advance(
      plan: plan,
      from: PlaybackPosition(
        complete: false,
        segmentIndex: segmentIndex,
        segmentPositionMilliseconds: segmentPositionMilliseconds,
      ),
      by: milliseconds,
    )
    segmentIndex = advanced.segmentIndex
    segmentPositionMilliseconds = advanced.segmentPositionMilliseconds
    if advanced.complete {
      complete()
      return
    }
    if segmentIndex != previousIndex {
      try? enterCurrentSegment()
    }
    persist(force: segmentIndex != previousIndex)
  }

  private func enterCurrentSegment() throws {
    guard let plan, plan.segments.indices.contains(segmentIndex) else { return }
    switch plan.segments[segmentIndex] {
    case .music:
      try audio.playMusicGap()
    case let .scene(scene):
      let asset = scene.audio.asset(for: motion.movement)
      guard let assetResolver else { return }
      try audio.playStory(
        url: assetResolver(asset.immutableKey),
        positionMilliseconds: segmentPositionMilliseconds,
      )
    }
  }

  private func resumeCurrentSegment() {
    guard let plan, plan.segments.indices.contains(segmentIndex) else { return }
    switch plan.segments[segmentIndex] {
    case .music:
      try? audio.resumeMusicGap()
    case .scene:
      audio.resumeStory()
    }
  }

  private func complete() {
    isComplete = true
    audio.stop()
    motion.stop()
    persist(completed: true, force: true)
  }

  private func persist(completed: Bool = false, force: Bool = false) {
    guard
      force ||
      totalActiveMilliseconds - lastPersistedActiveMilliseconds >= 5000
    else { return }
    lastPersistedActiveMilliseconds = totalActiveMilliseconds
    onProgress?(segmentIndex, segmentPositionMilliseconds, completed)
  }
}
