import ConvexMobile
import Foundation
import SwiftData

private struct ConvexJSON: ConvexEncodable {
  let value: Any

  func convexEncode() throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value)
    return String(decoding: data, as: UTF8.self)
  }
}

@MainActor
final class ProgressSyncService {
  private let client: ConvexClient

  init(client: ConvexClient) {
    self.client = client
  }

  func mergeGuestState(in context: ModelContext) async throws {
    let progress = try context.fetch(FetchDescriptor<EpisodeProgressRecord>())
    let runs = try context.fetch(
      FetchDescriptor<RunSessionRecord>(predicate: #Predicate { !$0.synced }),
    )
    guard !progress.isEmpty || !runs.isEmpty else { return }
    let defaults = UserDefaults.standard
    let idempotencyKey = defaults.string(forKey: "guestMergeIdempotencyKey")
      ?? UUID().uuidString.lowercased()
    defaults.set(idempotencyKey, forKey: "guestMergeIdempotencyKey")
    let progressPayload: [Any] = progress.map { item in
      var value: [String: Any] = [
        "clientSequence": item.clientSequence,
        "episodeId": item.episodeId,
        "planDurationMinutes": item.durationMinutes,
        "planHash": item.planHash,
        "positionMilliseconds": item.positionMilliseconds,
        "releaseId": item.releaseId,
        "sceneIndex": item.sceneIndex,
      ]
      if let completedAt = item.completedAt {
        value["completedAt"] = Int(completedAt.timeIntervalSince1970 * 1000)
      }
      return value
    }
    let runPayload: [Any] = runs.map { item in
      var value: [String: Any] = [
        "activeMilliseconds": item.activeMilliseconds,
        "completed": item.completed,
        "endedAt": Int(item.endedAt.timeIntervalSince1970 * 1000),
        "episodeId": item.episodeId,
        "idempotencyKey": item.idempotencyKey,
        "movementSamples": [
          "running": item.runningSamples,
          "stationary": item.stationarySamples,
          "walking": item.walkingSamples,
        ],
        "planHash": item.planHash,
        "releaseId": item.releaseId,
        "startedAt": Int(item.startedAt.timeIntervalSince1970 * 1000),
      ]
      if let distanceMeters = item.distanceMeters {
        value["distanceMeters"] = distanceMeters
      }
      if let steps = item.steps {
        value["steps"] = steps
      }
      return value
    }
    let _: MergeResult = try await client.mutation(
      "listener:mergeGuestState",
      with: [
        "idempotencyKey": idempotencyKey,
        "preferredGenres": ConvexJSON(value: []),
        "progress": ConvexJSON(value: progressPayload),
        "runs": ConvexJSON(value: runPayload),
      ],
    )
    runs.forEach { $0.synced = true }
    try context.save()
    defaults.removeObject(forKey: "guestMergeIdempotencyKey")
  }

  func sync(
    progress: EpisodeProgressRecord,
    run: RunSessionRecord,
    in context: ModelContext,
  ) async throws {
    var progressArgs: [String: ConvexEncodable?] = [
      "clientSequence": progress.clientSequence,
      "episodeId": progress.episodeId,
      "planDurationMinutes": progress.durationMinutes,
      "planHash": progress.planHash,
      "positionMilliseconds": progress.positionMilliseconds,
      "releaseId": progress.releaseId,
      "sceneIndex": progress.sceneIndex,
    ]
    if let completedAt = progress.completedAt {
      progressArgs["completedAt"] = Int(completedAt.timeIntervalSince1970 * 1000)
    }
    let _: Bool = try await client.mutation("listener:saveProgress", with: progressArgs)
    var runArgs: [String: ConvexEncodable?] = [
      "activeMilliseconds": run.activeMilliseconds,
      "completed": run.completed,
      "endedAt": Int(run.endedAt.timeIntervalSince1970 * 1000),
      "episodeId": run.episodeId,
      "idempotencyKey": run.idempotencyKey,
      "movementSamples": ConvexJSON(value: [
        "running": run.runningSamples,
        "stationary": run.stationarySamples,
        "walking": run.walkingSamples,
      ]),
      "planHash": run.planHash,
      "releaseId": run.releaseId,
      "startedAt": Int(run.startedAt.timeIntervalSince1970 * 1000),
    ]
    if let distanceMeters = run.distanceMeters {
      runArgs["distanceMeters"] = distanceMeters
    }
    if let steps = run.steps {
      runArgs["steps"] = steps
    }
    let _: Bool = try await client.mutation("listener:recordRun", with: runArgs)
    run.synced = true
    try context.save()
  }
}

private struct MergeResult: Decodable {
  let mergedProgress: Int
  let mergedRuns: Int
}
