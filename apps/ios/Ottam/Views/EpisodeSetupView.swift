import SwiftData
import SwiftUI

struct EpisodeSetupView: View {
  @Environment(AppServices.self) private var services
  @Environment(\.modelContext) private var modelContext
  @Query private var downloads: [DownloadedRelease]
  let episode: CatalogEpisode
  @State private var duration = 30.0
  @State private var errorMessage: String?
  @State private var isDownloading = false
  @State private var showRun = false

  private var downloaded: DownloadedRelease? {
    downloads.first { $0.releaseId == episode.releaseId }
  }

  var body: some View {
    Form {
      Section {
        Text(episode.synopsis)
          .font(.body)
      } header: {
        Text("Episode \(episode.sequence)")
      }
      Section("How long are you moving today?") {
        Text("\(Int(duration)) minutes")
          .font(.title2.weight(.semibold))
          .monospacedDigit()
        Slider(value: $duration, in: 15 ... 60, step: 1)
          .accessibilityLabel("Session duration")
        HStack {
          Text("15 min")
          Spacer()
          Text("60 min")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }
      Section {
        if downloaded == nil {
          Button(isDownloading ? "Downloading…" : "Download episode") {
            Task { await download() }
          }
          .disabled(isDownloading)
        } else {
          Button("Start episode", systemImage: "figure.run") {
            showRun = true
          }
        }
        if let errorMessage {
          Text(errorMessage).foregroundStyle(.red)
        }
      } footer: {
        Text("The full episode is stored offline. Your music can keep playing between story scenes.")
      }
    }
    .navigationTitle(episode.title)
    .navigationBarTitleDisplayMode(.inline)
    .fullScreenCover(isPresented: $showRun) {
      if let downloaded {
        RunView(
          bundleData: downloaded.bundleData,
          durationMinutes: Int(duration),
          episode: episode,
        )
      }
    }
  }

  private func download() async {
    isDownloading = true
    errorMessage = nil
    do {
      try await services.downloads.download(episode, into: modelContext)
    } catch {
      errorMessage = error.localizedDescription
    }
    isDownloading = false
  }
}
