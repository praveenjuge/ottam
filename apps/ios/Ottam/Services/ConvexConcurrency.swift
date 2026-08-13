import ConvexMobile

/// ConvexMobile delegates calls to its thread-safe UniFFI client, but 0.8.1 does not
/// declare Swift 6 sendability yet. Keep the unchecked boundary isolated here.
extension ConvexClient: @unchecked @retroactive Sendable {}
