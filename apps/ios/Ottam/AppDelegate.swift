import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void,
  ) {
    guard identifier == "com.praveenjuge.ottam.release-downloads" else {
      completionHandler()
      return
    }
    BackgroundDownloadCoordinator.shared.reconnect(
      completionHandler: completionHandler,
    )
  }
}
