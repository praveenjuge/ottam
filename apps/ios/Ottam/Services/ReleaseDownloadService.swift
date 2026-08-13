import ConvexMobile
import CryptoKit
import Foundation
import SwiftData

final class BackgroundDownloadCoordinator: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
  static let shared = BackgroundDownloadCoordinator()

  private let lock = NSLock()
  private var continuations: [Int: CheckedContinuation<URL, Error>] = [:]
  private var destinations: [Int: URL] = [:]
  private var eventsCompletionHandler: (() -> Void)?
  private lazy var session: URLSession = {
    let configuration = URLSessionConfiguration.background(
      withIdentifier: "com.praveenjuge.ottam.release-downloads",
    )
    configuration.allowsCellularAccess = true
    configuration.isDiscretionary = false
    configuration.sessionSendsLaunchEvents = true
    return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }()

  func download(from source: URL, to destination: URL) async throws -> URL {
    try await withCheckedThrowingContinuation { continuation in
      let task = session.downloadTask(with: source)
      task.taskDescription = destination.path
      lock.withLock {
        continuations[task.taskIdentifier] = continuation
        destinations[task.taskIdentifier] = destination
      }
      task.resume()
    }
  }

  func reconnect(completionHandler: @escaping () -> Void) {
    lock.withLock {
      eventsCompletionHandler = completionHandler
    }
    _ = session
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession _: URLSession) {
    let completion = lock.withLock {
      defer { eventsCompletionHandler = nil }
      return eventsCompletionHandler
    }
    DispatchQueue.main.async {
      completion?()
    }
  }

  func urlSession(
    _: URLSession,
    downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL,
  ) {
    let destination = lock.withLock {
      destinations.removeValue(forKey: downloadTask.taskIdentifier)
    } ?? downloadTask.taskDescription.map(URL.init(fileURLWithPath:))
    guard let destination else { return }
    do {
      try FileManager.default.createDirectory(
        at: destination.deletingLastPathComponent(),
        withIntermediateDirectories: true,
      )
      if FileManager.default.fileExists(atPath: destination.path) {
        _ = try FileManager.default.replaceItemAt(destination, withItemAt: location)
      } else {
        try FileManager.default.moveItem(at: location, to: destination)
      }
      resume(downloadTask, with: .success(destination))
    } catch {
      resume(downloadTask, with: .failure(error))
    }
  }

  func urlSession(
    _: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?,
  ) {
    if let error {
      resume(task, with: .failure(error))
    }
  }

  private func resume(_ task: URLSessionTask, with result: Result<URL, Error>) {
    let continuation = lock.withLock {
      destinations.removeValue(forKey: task.taskIdentifier)
      return continuations.removeValue(forKey: task.taskIdentifier)
    }
    continuation?.resume(with: result)
  }
}

@MainActor
final class ReleaseDownloadService {
  private let client: ConvexClient
  private let coordinator: BackgroundDownloadCoordinator

  init(
    client: ConvexClient,
    coordinator: BackgroundDownloadCoordinator = .shared,
  ) {
    self.client = client
    self.coordinator = coordinator
  }

  func download(_ episode: CatalogEpisode, into context: ModelContext) async throws {
    let access: ReleaseAccess = try await client.action(
      "releaseAccess:bundle",
      with: ["releaseId": episode.releaseId],
    )
    let root = try releaseDirectory(episode.releaseId)
    let manifestURL = root.appending(path: "manifest.json")
    let downloadedManifest = try await coordinator.download(
      from: access.manifestUrl,
      to: manifestURL,
    )
    let manifestData = try Data(contentsOf: downloadedManifest)
    guard sha256(manifestData) == access.manifestChecksumSha256 else {
      throw DownloadError.checksumMismatch
    }
    let bundle = try JSONDecoder().decode(EpisodeReleaseBundle.self, from: manifestData)
    guard bundle.hasValidCoverage(
      episodeId: episode.episodeId,
      releaseId: episode.releaseId,
    ) else {
      throw DownloadError.invalidManifest
    }
    let references = bundle.manifest.scenes.flatMap { scene -> [AudioAssetReference] in
      switch scene.audio {
      case let .standard(asset): [asset]
      case let .reactive(walking, running): [walking, running]
      }
    }
    let groupedReferences = Dictionary(grouping: references, by: \.immutableKey)
    let uniqueReferences = try groupedReferences.values.map { matches in
      guard let reference = matches.first,
            matches.allSatisfy({ $0 == reference })
      else {
        throw DownloadError.invalidManifest
      }
      return reference
    }
    let signedByKey = Dictionary(uniqueKeysWithValues: access.assets.map { ($0.key, $0.url) })
    try await withThrowingTaskGroup(of: Void.self) { group in
      for reference in uniqueReferences {
        guard let source = signedByKey[reference.immutableKey] else {
          throw DownloadError.missingSignedURL
        }
        let destination = try localAudioURL(
          releaseId: episode.releaseId,
          key: reference.immutableKey,
        )
        group.addTask { [coordinator] in
          let file = try await coordinator.download(from: source, to: destination)
          let data = try Data(contentsOf: file, options: .mappedIfSafe)
          guard data.count == reference.bytes, sha256(data) == reference.checksumSha256 else {
            throw DownloadError.checksumMismatch
          }
        }
      }
      try await group.waitForAll()
    }
    let descriptor = FetchDescriptor<DownloadedRelease>(
      predicate: #Predicate { $0.releaseId == episode.releaseId },
    )
    if let existing = try context.fetch(descriptor).first {
      existing.bundleData = manifestData
      existing.downloadedAt = .now
    } else {
      context.insert(
        DownloadedRelease(
          releaseId: episode.releaseId,
          episodeId: episode.episodeId,
          bundleData: manifestData,
        ),
      )
    }
    try context.save()
  }

  func localAudioURL(releaseId: String, key: String) throws -> URL {
    let filename = sha256(Data(key.utf8))
    return try releaseDirectory(releaseId).appending(path: filename)
  }

  private func releaseDirectory(_ releaseId: String) throws -> URL {
    guard releaseId.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil else {
      throw DownloadError.invalidManifest
    }
    let support = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true,
    )
    return support.appending(path: "releases", directoryHint: .isDirectory)
      .appending(path: releaseId, directoryHint: .isDirectory)
  }
}

private func sha256(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

enum DownloadError: LocalizedError {
  case checksumMismatch
  case invalidManifest
  case missingSignedURL

  var errorDescription: String? {
    switch self {
    case .checksumMismatch: "Downloaded media did not pass checksum validation."
    case .invalidManifest: "The episode release package is invalid."
    case .missingSignedURL: "A private media URL is missing from the release."
    }
  }
}
