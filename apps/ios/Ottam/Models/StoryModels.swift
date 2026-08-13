import Foundation

struct CatalogSeries: Codable, Identifiable, Sendable {
  let description: String
  let episodes: [CatalogEpisode]
  let genre: String
  let seriesId: String
  let slug: String
  let title: String

  var id: String {
    seriesId
  }
}

struct CatalogEpisode: Codable, Hashable, Identifiable, Sendable {
  let episodeId: String
  let releaseId: String
  let sequence: Int
  let slug: String
  let synopsis: String
  let title: String

  var id: String {
    episodeId
  }
}

struct ReleaseAccess: Codable, Sendable {
  let assets: [SignedAsset]
  let expiresInSeconds: Int
  let manifestChecksumSha256: String
  let manifestUrl: URL
}

struct SignedAsset: Codable, Sendable {
  let key: String
  let url: URL
}

struct EpisodeReleaseBundle: Codable, Sendable {
  let contractVersion: Int
  let manifest: EpisodeManifest
  let plans: [PlaybackPlan]

  func plan(minutes: Int) -> PlaybackPlan? {
    plans.first { $0.targetMinutes == minutes }
  }

  func hasValidCoverage(episodeId: String, releaseId: String) -> Bool {
    guard
      contractVersion == 1,
      manifest.contractVersion == 1,
      manifest.episodeId == episodeId,
      manifest.releaseId == releaseId,
      plans.count == 46
    else { return false }
    return plans.enumerated().allSatisfy { offset, plan in
      let minutes = offset + 15
      let storySeconds = plan.segments.reduce(0) { total, segment in
        if case .scene = segment {
          return total + segment.durationSeconds
        }
        return total
      }
      let musicSeconds = plan.segments.reduce(0) { total, segment in
        if case .music = segment {
          return total + segment.durationSeconds
        }
        return total
      }
      return plan.targetMinutes == minutes
        && plan.targetSeconds == minutes * 60
        && plan.episodeId == episodeId
        && plan.releaseId == releaseId
        && plan.storySeconds == storySeconds
        && plan.musicSeconds == musicSeconds
        && storySeconds + musicSeconds == plan.targetSeconds
        && plan.planHash.range(
          of: #"^[a-f0-9]{64}$"#,
          options: .regularExpression,
        ) != nil
    }
  }
}

struct EpisodeManifest: Codable, Sendable {
  let contractVersion: Int
  let episodeId: String
  let releaseId: String
  let revisionId: String
  let scenes: [StoryScene]
  let title: String
}

struct StoryScene: Codable, Identifiable, Sendable {
  let audio: SceneAudio
  let durationSeconds: Int
  let kind: SceneKind
  let optionalPriority: Int?
  let script: String
  let sortOrder: Int
  let stableKey: String
  let title: String

  var id: String {
    stableKey
  }
}

enum SceneKind: String, Codable, Sendable {
  case core
  case optional
  case reactive
}

struct AudioAssetReference: Codable, Equatable, Sendable {
  let bytes: Int
  let checksumSha256: String
  let durationSeconds: Int
  let immutableKey: String
  let mimeType: String
}

enum SceneAudio: Codable, Sendable {
  case standard(AudioAssetReference)
  case reactive(walking: AudioAssetReference, running: AudioAssetReference)

  private enum CodingKeys: String, CodingKey {
    case `default`
    case running
    case walking
  }

  init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    if let standard = try values.decodeIfPresent(
      AudioAssetReference.self,
      forKey: .default,
    ) {
      self = .standard(standard)
      return
    }
    self = try .reactive(
      walking: values.decode(AudioAssetReference.self, forKey: .walking),
      running: values.decode(AudioAssetReference.self, forKey: .running),
    )
  }

  func encode(to encoder: Encoder) throws {
    var values = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case let .standard(asset):
      try values.encode(asset, forKey: .default)
    case let .reactive(walking, running):
      try values.encode(walking, forKey: .walking)
      try values.encode(running, forKey: .running)
    }
  }

  func asset(for movement: MovementState) -> AudioAssetReference {
    switch self {
    case let .standard(asset):
      asset
    case let .reactive(walking, running):
      movement == .running ? running : walking
    }
  }
}

struct PlaybackPlan: Codable, Sendable {
  let density: Double
  let episodeId: String
  let musicSeconds: Int
  let planHash: String
  let releaseId: String
  let segments: [PlaybackSegment]
  let storySeconds: Int
  let targetMinutes: Int
  let targetSeconds: Int
}

enum PlaybackSegment: Codable, Sendable {
  case music(durationSeconds: Int)
  case scene(SceneSegment)

  private enum CodingKeys: String, CodingKey {
    case audio
    case durationSeconds
    case kind
    case sceneKey
    case type
  }

  private enum SegmentType: String, Codable {
    case music
    case scene
  }

  init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    switch try values.decode(SegmentType.self, forKey: .type) {
    case .music:
      self = try .music(
        durationSeconds: values.decode(Int.self, forKey: .durationSeconds),
      )
    case .scene:
      self = try .scene(
        SceneSegment(
          audio: values.decode(SceneAudio.self, forKey: .audio),
          durationSeconds: values.decode(Int.self, forKey: .durationSeconds),
          kind: values.decode(SceneKind.self, forKey: .kind),
          sceneKey: values.decode(String.self, forKey: .sceneKey),
        ),
      )
    }
  }

  func encode(to encoder: Encoder) throws {
    var values = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case let .music(durationSeconds):
      try values.encode(SegmentType.music, forKey: .type)
      try values.encode(durationSeconds, forKey: .durationSeconds)
    case let .scene(scene):
      try values.encode(SegmentType.scene, forKey: .type)
      try values.encode(scene.audio, forKey: .audio)
      try values.encode(scene.durationSeconds, forKey: .durationSeconds)
      try values.encode(scene.kind, forKey: .kind)
      try values.encode(scene.sceneKey, forKey: .sceneKey)
    }
  }

  var durationSeconds: Int {
    switch self {
    case let .music(seconds): seconds
    case let .scene(scene): scene.durationSeconds
    }
  }
}

struct SceneSegment: Codable, Sendable {
  let audio: SceneAudio
  let durationSeconds: Int
  let kind: SceneKind
  let sceneKey: String
}

enum MovementState: String, Codable, CaseIterable, Sendable {
  case walking
  case running
  case stationary
}
