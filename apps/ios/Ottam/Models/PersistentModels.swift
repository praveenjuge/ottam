import Foundation
import SwiftData

@Model
final class DownloadedRelease {
  @Attribute(.unique) var releaseId: String
  var bundleData: Data
  var downloadedAt: Date
  var episodeId: String

  init(releaseId: String, episodeId: String, bundleData: Data) {
    self.releaseId = releaseId
    self.episodeId = episodeId
    self.bundleData = bundleData
    self.downloadedAt = .now
  }
}

@Model
final class EpisodeProgressRecord {
  @Attribute(.unique) var episodeId: String
  var clientSequence: Int
  var completedAt: Date?
  var durationMinutes: Int
  var planHash: String
  var positionMilliseconds: Int
  var releaseId: String
  var sceneIndex: Int
  var updatedAt: Date

  init(episodeId: String, releaseId: String, durationMinutes: Int, planHash: String) {
    self.episodeId = episodeId
    self.releaseId = releaseId
    self.durationMinutes = durationMinutes
    self.planHash = planHash
    self.clientSequence = 0
    self.positionMilliseconds = 0
    self.sceneIndex = 0
    self.updatedAt = .now
  }
}

@Model
final class RunSessionRecord {
  @Attribute(.unique) var idempotencyKey: String
  var activeMilliseconds: Int
  var completed: Bool
  var distanceMeters: Double?
  var endedAt: Date
  var episodeId: String
  var planHash: String
  var releaseId: String
  var runningSamples: Int
  var startedAt: Date
  var stationarySamples: Int
  var steps: Int?
  var synced: Bool
  var walkingSamples: Int

  init(episodeId: String, releaseId: String, planHash: String, startedAt: Date) {
    self.idempotencyKey = UUID().uuidString.lowercased()
    self.episodeId = episodeId
    self.releaseId = releaseId
    self.planHash = planHash
    self.startedAt = startedAt
    self.endedAt = startedAt
    self.activeMilliseconds = 0
    self.completed = false
    self.runningSamples = 0
    self.stationarySamples = 0
    self.walkingSamples = 0
    self.synced = false
  }
}
