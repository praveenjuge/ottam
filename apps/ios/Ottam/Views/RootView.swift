import ClerkKit
import ClerkKitUI
import SwiftData
import SwiftUI

struct RootView: View {
  @Environment(Clerk.self) private var clerk
  @Environment(AppServices.self) private var services
  @Environment(\.modelContext) private var modelContext
  @Query private var progress: [EpisodeProgressRecord]
  @State private var authIsPresented = false
  @State private var catalog: CatalogStore?

  private var completedGuestEpisode: Bool {
    progress.contains { $0.completedAt != nil }
  }

  var body: some View {
    Group {
      if let catalog {
        MainTabs(
          canSignIn: completedGuestEpisode,
          catalog: catalog,
          authIsPresented: $authIsPresented,
        )
      } else {
        ProgressView("Opening Ottam…")
      }
    }
    .task {
      if catalog == nil {
        catalog = CatalogStore(client: services.convex)
      }
    }
    .onChange(of: clerk.user?.id, initial: true) { _, userId in
      guard userId != nil else { return }
      Task {
        try? await ProgressSyncService(client: services.convex)
          .mergeGuestState(in: modelContext)
      }
    }
    .onChange(of: completedGuestEpisode) { _, completed in
      if completed, clerk.user == nil {
        authIsPresented = true
      }
    }
    .sheet(isPresented: $authIsPresented) {
      AuthView()
    }
  }
}

private struct MainTabs: View {
  let canSignIn: Bool
  let catalog: CatalogStore
  @Binding var authIsPresented: Bool

  var body: some View {
    TabView {
      Tab("Home", systemImage: "play.rectangle.fill") {
        HomeView(catalog: catalog)
      }
      Tab("Library", systemImage: "arrow.down.circle.fill") {
        LibraryView()
      }
      Tab("Activity", systemImage: "figure.walk") {
        ActivityView(
          authIsPresented: $authIsPresented,
          canSignIn: canSignIn,
        )
      }
    }
    .tint(.orange)
  }
}
