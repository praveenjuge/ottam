# Ottam iOS

Native iOS 18+ SwiftUI listener app. The checked-in Xcode project is generated from `project.yml` with XcodeGen so package versions, capabilities, build settings, and targets remain reviewable.

The app uses ClerkKitUI's native email-code authentication after the first guest episode, ClerkConvex with ConvexMobile for sync, SwiftData for durable local state, background URLSession downloads, AVFoundation for mixed/ducked audio, and Core Motion for supportive walking/running branches.

Run `bun run project` after changing `project.yml`, then use `bun run test` for simulator tests or `bun run build` for a signing-free simulator build.
