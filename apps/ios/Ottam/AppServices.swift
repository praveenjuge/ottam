import ClerkConvex
import ClerkKit
import ConvexMobile
import Foundation
import Observation

@MainActor
@Observable
final class AppServices {
  let convex: ConvexClientWithAuth<String>
  let downloads: ReleaseDownloadService

  init() {
    let client = ConvexClientWithAuth(
      deploymentUrl: AppConfiguration.convexURL.absoluteString,
      authProvider: ClerkConvexAuthProvider(),
    )
    self.convex = client
    self.downloads = ReleaseDownloadService(client: client)
  }
}

enum AppConfiguration {
  static let clerkPublishableKey = requiredString(for: "OTTAMClerkPublishableKey")
  static let convexURL = requiredURL(for: "OTTAMConvexURL")

  private static func requiredString(for key: String) -> String {
    guard
      let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
      !value.isEmpty,
      !value.contains("$(")
    else {
      preconditionFailure("Missing required app configuration: \(key)")
    }
    return value
  }

  private static func requiredURL(for key: String) -> URL {
    let value = requiredString(for: key)
    guard
      let url = URL(string: value),
      url.scheme == "https",
      url.host?.hasSuffix(".convex.cloud") == true
    else {
      preconditionFailure("Invalid HTTPS Convex URL in app configuration: \(key)")
    }
    return url
  }
}
