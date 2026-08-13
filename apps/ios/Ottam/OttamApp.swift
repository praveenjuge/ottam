import ClerkKit
import ClerkKitUI
import SwiftData
import SwiftUI

@main
struct OttamApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @State private var services: AppServices

  init() {
    Clerk.configure(publishableKey: "pk_test_a25vd24tY2FpbWFuLTM4LmNsZXJrLmFjY291bnRzLmRldiQ")
    _services = State(initialValue: AppServices())
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        .prefetchClerkImages()
        .environment(Clerk.shared)
        .environment(services)
    }
    .modelContainer(
      for: [DownloadedRelease.self, EpisodeProgressRecord.self, RunSessionRecord.self],
    )
  }
}
