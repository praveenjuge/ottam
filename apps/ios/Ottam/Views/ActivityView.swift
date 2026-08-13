import ClerkKitUI
import SwiftData
import SwiftUI

struct ActivityView: View {
  @Binding var authIsPresented: Bool
  let canSignIn: Bool
  @Query(sort: \RunSessionRecord.endedAt, order: .reverse)
  private var runs: [RunSessionRecord]

  var body: some View {
    NavigationStack {
      List {
        Section {
          if canSignIn {
            UserButton(signedOutContent: {
              Button("Sign in to sync progress") {
                authIsPresented = true
              }
            })
          } else {
            Label(
              "Complete your first episode to unlock progress sync.",
              systemImage: "lock",
            )
            .foregroundStyle(.secondary)
          }
        } footer: {
          Text("Guest play stays on this iPhone. Sign in after your first episode to merge and sync it.")
        }
        Section("Outings") {
          if runs.isEmpty {
            Text("Your completed and paused outings appear here.")
              .foregroundStyle(.secondary)
          } else {
            ForEach(runs) { run in
              RunRow(run: run)
            }
          }
        }
      }
      .navigationTitle("Activity")
    }
  }
}

private struct RunRow: View {
  let run: RunSessionRecord

  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 3) {
        Text(run.completed ? "Episode complete" : "Episode paused")
          .font(.headline)
        Text(run.endedAt, format: .dateTime.month().day().hour().minute())
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer()
      VStack(alignment: .trailing) {
        Text(Duration.milliseconds(run.activeMilliseconds), format: .time(pattern: .minuteSecond))
          .monospacedDigit()
        if let steps = run.steps {
          Text("\(steps) steps")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    }
  }
}
