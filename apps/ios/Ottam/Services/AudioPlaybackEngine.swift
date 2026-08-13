import AVFoundation

@MainActor
final class AudioPlaybackEngine {
  private let audioEngine = AVAudioEngine()
  private let player = AVPlayer()
  private let silentNode = AVAudioPlayerNode()
  private var silentBuffer: AVAudioPCMBuffer?

  init() {
    let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)
    if let format,
       let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4410)
    {
      buffer.frameLength = buffer.frameCapacity
      self.silentBuffer = buffer
      audioEngine.attach(silentNode)
      audioEngine.connect(silentNode, to: audioEngine.mainMixerNode, format: format)
    }
  }

  func playStory(url: URL, positionMilliseconds: Int) throws {
    silentNode.stop()
    try configureSession(ducking: true)
    let item = AVPlayerItem(url: url)
    player.replaceCurrentItem(with: item)
    let time = CMTime(value: CMTimeValue(positionMilliseconds), timescale: 1000)
    player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    player.play()
  }

  func playMusicGap() throws {
    player.pause()
    try configureSession(ducking: false)
    guard let silentBuffer else { return }
    if !audioEngine.isRunning {
      try audioEngine.start()
    }
    if !silentNode.isPlaying {
      silentNode.scheduleBuffer(silentBuffer, at: nil, options: .loops)
      silentNode.play()
    }
  }

  func pause() {
    player.pause()
    silentNode.pause()
  }

  func resumeMusicGap() throws {
    try configureSession(ducking: false)
    if !audioEngine.isRunning {
      try audioEngine.start()
    }
    silentNode.play()
  }

  func resumeStory() {
    player.play()
  }

  func stop() {
    player.pause()
    player.replaceCurrentItem(with: nil)
    silentNode.stop()
    audioEngine.stop()
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation,
    )
  }

  private func configureSession(ducking: Bool) throws {
    let session = AVAudioSession.sharedInstance()
    var options: AVAudioSession.CategoryOptions = [.mixWithOthers]
    if ducking {
      options.insert(.duckOthers)
    }
    try session.setCategory(.playback, mode: .spokenAudio, options: options)
    try session.setActive(true)
  }
}
