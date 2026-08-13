import Foundation
@testable import Ottam
import Testing

struct PlaybackTimelineTests {
  @Test
  func `resume preserves exact valid position`() throws {
    let plan = try fixturePlan()
    let position = PlaybackTimeline.resume(
      plan: plan,
      segmentIndex: 1,
      positionMilliseconds: 12345,
    )
    #expect(position.segmentIndex == 1)
    #expect(position.segmentPositionMilliseconds == 12345)
    #expect(!position.complete)
  }

  @Test
  func `resume clamps malformed local progress and recognizes completion`() throws {
    let plan = try fixturePlan()
    let clamped = PlaybackTimeline.resume(
      plan: plan,
      segmentIndex: -4,
      positionMilliseconds: -100,
    )
    #expect(clamped.segmentIndex == 0)
    #expect(clamped.segmentPositionMilliseconds == 0)
    #expect(!clamped.complete)

    let complete = PlaybackTimeline.resume(
      plan: plan,
      segmentIndex: plan.segments.count,
      positionMilliseconds: 55,
    )
    #expect(complete.complete)
    #expect(complete.segmentIndex == plan.segments.count)
    #expect(complete.segmentPositionMilliseconds == 0)
  }

  @Test
  func `stationary time does not advance and active time crosses segments`() throws {
    let plan = try fixturePlan()
    let start = PlaybackTimeline.resume(
      plan: plan,
      segmentIndex: 0,
      positionMilliseconds: 44500,
    )
    #expect(PlaybackTimeline.advance(plan: plan, from: start, by: 0) == start)
    let advanced = PlaybackTimeline.advance(plan: plan, from: start, by: 1500)
    #expect(advanced.segmentIndex == 1)
    #expect(advanced.segmentPositionMilliseconds == 1000)
  }

  @Test
  func `large active delta finishes once at the canonical boundary`() throws {
    let plan = try fixturePlan()
    let start = PlaybackTimeline.resume(
      plan: plan,
      segmentIndex: 0,
      positionMilliseconds: 0,
    )
    let complete = PlaybackTimeline.advance(
      plan: plan,
      from: start,
      by: plan.targetSeconds * 1000 + 1,
    )
    #expect(complete.complete)
    #expect(complete.segmentIndex == plan.segments.count)
    #expect(PlaybackTimeline.advance(plan: plan, from: complete, by: 5000) == complete)
  }

  @Test
  func `reactive audio selects walking unless actively running`() throws {
    let bundle = try JSONDecoder().decode(
      EpisodeReleaseBundle.self,
      from: fixtureBundleData(),
    )
    let reactive = try #require(bundle.manifest.scenes.first { $0.kind == .reactive })
    #expect(reactive.audio.asset(for: .walking).immutableKey.contains("walking"))
    #expect(reactive.audio.asset(for: .stationary).immutableKey.contains("walking"))
    #expect(reactive.audio.asset(for: .running).immutableKey.contains("running"))
  }

  @Test
  func `release coverage requires every whole minute in canonical order`() throws {
    let fixture = try JSONDecoder().decode(
      EpisodeReleaseBundle.self,
      from: fixtureBundleData(),
    )
    let base = try #require(fixture.plans.first)
    let scenes = base.segments.filter {
      if case .scene = $0 {
        return true
      }
      return false
    }
    let plans = (15 ... 60).map { minutes in
      let target = minutes * 60
      let story = scenes.reduce(0) { $0 + $1.durationSeconds }
      return PlaybackPlan(
        density: Double(story) / Double(target),
        episodeId: fixture.manifest.episodeId,
        musicSeconds: target - story,
        planHash: String(repeating: "a", count: 64),
        releaseId: fixture.manifest.releaseId,
        segments: scenes + [.music(durationSeconds: target - story)],
        storySeconds: story,
        targetMinutes: minutes,
        targetSeconds: target,
      )
    }
    let bundle = EpisodeReleaseBundle(
      contractVersion: 1,
      manifest: fixture.manifest,
      plans: plans,
    )
    #expect(bundle.hasValidCoverage(episodeId: "episode", releaseId: "release"))
    #expect(!bundle.hasValidCoverage(episodeId: "other", releaseId: "release"))
    let reversed = EpisodeReleaseBundle(
      contractVersion: 1,
      manifest: fixture.manifest,
      plans: Array(plans.reversed()),
    )
    #expect(!reversed.hasValidCoverage(episodeId: "episode", releaseId: "release"))
  }
}

private func fixturePlan() throws -> PlaybackPlan {
  let bundle = try JSONDecoder().decode(
    EpisodeReleaseBundle.self,
    from: fixtureBundleData(),
  )
  return try #require(bundle.plans.first)
}

private func fixtureBundleData() -> Data {
  let checksum = String(repeating: "0", count: 64)
  let standard = """
  {"bytes":1,"checksumSha256":"\(checksum)","durationSeconds":45,"immutableKey":"releases/r/audio/default.m4a","mimeType":"audio/mp4"}
  """
  let walking = standard.replacingOccurrences(of: "default", with: "walking")
  let running = standard.replacingOccurrences(of: "default", with: "running")
  let hash = String(repeating: "a", count: 64)
  return Data("""
  {"contractVersion":1,"manifest":{"contractVersion":1,"episodeId":"episode","releaseId":"release","revisionId":"revision","title":"Fixture","scenes":[{"audio":{"default":\(standard)},"durationSeconds":45,"kind":"core","script":"Open","sortOrder":0,"stableKey":"open","title":"Open"},{"audio":{"walking":\(walking),"running":\(running)},"durationSeconds":45,"kind":"reactive","script":"Move","sortOrder":1,"stableKey":"move","title":"Move"}]},"plans":[{"density":0.3,"episodeId":"episode","musicSeconds":630,"planHash":"\(hash)","releaseId":"release","segments":[{"audio":{"default":\(standard)},"durationSeconds":45,"kind":"core","sceneKey":"open","type":"scene"},{"durationSeconds":630,"type":"music"},{"audio":{"walking":\(walking),"running":\(running)},"durationSeconds":45,"kind":"reactive","sceneKey":"move","type":"scene"}],"storySeconds":270,"targetMinutes":15,"targetSeconds":900}]}
  """.utf8)
}
