import SwiftUI

struct HomeView: View {
  let catalog: CatalogStore

  var body: some View {
    NavigationStack {
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 24) {
          if catalog.isLoading {
            ProgressView("Loading stories…")
          } else if let error = catalog.errorMessage {
            ContentUnavailableView(
              "Stories unavailable",
              systemImage: "wifi.exclamationmark",
              description: Text(error),
            )
          } else if catalog.series.isEmpty {
            ContentUnavailableView(
              "Stories are in production",
              systemImage: "waveform",
              description: Text("Your first cinematic outing will appear here after it is published."),
            )
          } else {
            ForEach(catalog.series) { series in
              SeriesShelf(series: series)
            }
          }
        }
        .padding()
      }
      .navigationTitle("Ottam")
      .background(Color(.systemGroupedBackground))
    }
  }
}

private struct SeriesShelf: View {
  let series: CatalogSeries

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ZStack(alignment: .bottomLeading) {
        LinearGradient(
          colors: [.black, .orange.opacity(0.8)],
          startPoint: .topTrailing,
          endPoint: .bottomLeading,
        )
        VStack(alignment: .leading, spacing: 6) {
          Text(series.genre.uppercased())
            .font(.caption.weight(.semibold))
            .foregroundStyle(.orange)
          Text(series.title)
            .font(.title2.weight(.bold))
            .foregroundStyle(.white)
          Text(series.description)
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.8))
            .lineLimit(2)
        }
        .padding(20)
      }
      .containerRelativeFrame(.horizontal)
      .frame(height: 220)
      .clipShape(.rect(cornerRadius: 22))
      ForEach(series.episodes) { episode in
        NavigationLink(value: episode) {
          EpisodeRow(episode: episode)
        }
        .buttonStyle(.plain)
      }
    }
    .navigationDestination(for: CatalogEpisode.self) { episode in
      EpisodeSetupView(episode: episode)
    }
  }
}

private struct EpisodeRow: View {
  let episode: CatalogEpisode

  var body: some View {
    HStack(spacing: 14) {
      Text(String(episode.sequence).padStart(2))
        .font(.caption.monospacedDigit())
        .foregroundStyle(.secondary)
      VStack(alignment: .leading, spacing: 3) {
        Text(episode.title).font(.headline)
        Text(episode.synopsis)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
      Spacer()
      Image(systemName: "chevron.right")
        .font(.caption.weight(.bold))
        .foregroundStyle(.tertiary)
    }
    .contentShape(.rect)
  }
}

private extension String {
  func padStart(_ length: Int) -> String {
    String(repeating: "0", count: max(0, length - count)) + self
  }
}
