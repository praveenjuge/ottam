import Foundation

struct PlaybackPosition: Equatable, Sendable {
  let complete: Bool
  let segmentIndex: Int
  let segmentPositionMilliseconds: Int
}

enum PlaybackTimeline {
  static func resume(
    plan: PlaybackPlan,
    segmentIndex: Int,
    positionMilliseconds: Int,
  ) -> PlaybackPosition {
    guard !plan.segments.isEmpty else {
      return PlaybackPosition(
        complete: true,
        segmentIndex: 0,
        segmentPositionMilliseconds: 0,
      )
    }
    if segmentIndex >= plan.segments.count {
      return PlaybackPosition(
        complete: true,
        segmentIndex: plan.segments.count,
        segmentPositionMilliseconds: 0,
      )
    }
    let index = min(max(0, segmentIndex), plan.segments.count - 1)
    let maximum = max(0, plan.segments[index].durationSeconds * 1000 - 1)
    return PlaybackPosition(
      complete: false,
      segmentIndex: index,
      segmentPositionMilliseconds: min(max(0, positionMilliseconds), maximum),
    )
  }

  static func advance(
    plan: PlaybackPlan,
    from position: PlaybackPosition,
    by milliseconds: Int,
  ) -> PlaybackPosition {
    guard !position.complete, milliseconds > 0 else { return position }
    var index = position.segmentIndex
    var offset = position.segmentPositionMilliseconds
    var remaining = milliseconds
    while plan.segments.indices.contains(index) {
      let segmentRemaining = plan.segments[index].durationSeconds * 1000 - offset
      if remaining < segmentRemaining {
        return PlaybackPosition(
          complete: false,
          segmentIndex: index,
          segmentPositionMilliseconds: offset + remaining,
        )
      }
      remaining -= segmentRemaining
      index += 1
      offset = 0
    }
    return PlaybackPosition(
      complete: true,
      segmentIndex: plan.segments.count,
      segmentPositionMilliseconds: 0,
    )
  }
}
