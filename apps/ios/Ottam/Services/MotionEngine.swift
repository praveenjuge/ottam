import CoreMotion
import Observation

@MainActor
@Observable
final class MotionEngine {
  private let activityManager = CMMotionActivityManager()
  private let pedometer = CMPedometer()
  private(set) var distanceMeters: Double = 0
  private(set) var movement: MovementState = .stationary
  private(set) var runningSamples = 0
  private(set) var stationarySamples = 0
  private(set) var steps = 0
  private(set) var walkingSamples = 0

  func start() {
    guard CMMotionActivityManager.isActivityAvailable() else {
      movement = .walking
      return
    }
    activityManager.startActivityUpdates(to: .main) { [weak self] activity in
      guard let self, let activity else { return }
      Task { @MainActor in
        if activity.running {
          movement = .running
          runningSamples += 1
        } else if activity.walking {
          movement = .walking
          walkingSamples += 1
        } else if activity.stationary {
          movement = .stationary
          stationarySamples += 1
        }
      }
    }
    guard CMPedometer.isStepCountingAvailable() else { return }
    pedometer.startUpdates(from: .now) { [weak self] data, _ in
      guard let self, let data else { return }
      Task { @MainActor in
        steps = data.numberOfSteps.intValue
        distanceMeters = data.distance?.doubleValue ?? distanceMeters
      }
    }
  }

  func stop() {
    activityManager.stopActivityUpdates()
    pedometer.stopUpdates()
  }
}
