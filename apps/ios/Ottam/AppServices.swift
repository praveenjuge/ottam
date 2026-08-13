import ClerkConvex
import ClerkKit
import ConvexMobile
import Observation

@MainActor
@Observable
final class AppServices {
  let convex: ConvexClientWithAuth<String>
  let downloads: ReleaseDownloadService

  init() {
    let client = ConvexClientWithAuth(
      deploymentUrl: "https://wary-caribou-993.eu-west-1.convex.cloud",
      authProvider: ClerkConvexAuthProvider(),
    )
    self.convex = client
    self.downloads = ReleaseDownloadService(client: client)
  }
}
