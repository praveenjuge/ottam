import SwiftData
import SwiftUI

struct LibraryView: View {
  @Query(sort: \DownloadedRelease.downloadedAt, order: .reverse)
  private var downloads: [DownloadedRelease]

  var body: some View {
    NavigationStack {
      Group {
        if downloads.isEmpty {
          ContentUnavailableView(
            "Nothing downloaded",
            systemImage: "arrow.down.circle",
            description: Text("Download an episode before you head out."),
          )
        } else {
          List(downloads) { download in
            if let bundle = try? JSONDecoder().decode(
              EpisodeReleaseBundle.self,
              from: download.bundleData,
            ) {
              NavigationLink(bundle.manifest.title) {
                LocalEpisodeView(bundle: bundle)
              }
            }
          }
        }
      }
      .navigationTitle("Downloads")
    }
  }
}

private struct LocalEpisodeView: View {
  let bundle: EpisodeReleaseBundle
  @State private var duration = 30.0
  @State private var showRun = false

  var body: some View {
    Form {
      Section("Offline episode") {
        Label("Ready without internet", systemImage: "checkmark.circle.fill")
          .foregroundStyle(.green)
      }
      Section("Duration") {
        Text("\(Int(duration)) minutes")
          .font(.title2.weight(.semibold))
        Slider(value: $duration, in: 15 ... 60, step: 1)
          .accessibilityLabel("Session duration")
          .accessibilityValue("\(Int(duration)) minutes")
      }
      Button("Start episode", systemImage: "figure.run") {
        showRun = true
      }
    }
    .navigationTitle(bundle.manifest.title)
    .fullScreenCover(isPresented: $showRun) {
      RunView(
        bundleData: (try? JSONEncoder().encode(bundle)) ?? Data(),
        durationMinutes: Int(duration),
        episode: CatalogEpisode(
          episodeId: bundle.manifest.episodeId,
          releaseId: bundle.manifest.releaseId,
          sequence: 0,
          slug: "offline",
          synopsis: "Downloaded episode",
          title: bundle.manifest.title,
        ),
      )
    }
  }
}
