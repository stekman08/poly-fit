import AVFoundation
import UIKit

@MainActor
public final class PlatformFeedback {
    public var soundEnabled = true
    public var hapticsEnabled = true
    private var audioPlayer: AVAudioPlayer?

    public init() {}

    public func rotate() {
        guard hapticsEnabled else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        playTone(frequency: 880, duration: 0.08)
    }

    public func flip() {
        guard hapticsEnabled else { return }
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
        playTone(frequency: 440, duration: 0.12)
    }

    public func snap() {
        guard hapticsEnabled else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        playTone(frequency: 200, duration: 0.08)
    }

    public func win() {
        guard hapticsEnabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        playTone(frequency: 784, duration: 0.2)
    }

    private func playTone(frequency: Double, duration: Double) {
        guard soundEnabled else { return }
        let sampleRate = 44_100.0
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount),
              let channelData = buffer.floatChannelData?[0] else { return }
        buffer.frameLength = frameCount
        for frameIndex in 0..<Int(frameCount) {
            let phase = Double(frameIndex) / sampleRate
            let envelope = 1 - Double(frameIndex) / Double(frameCount)
            channelData[frameIndex] = Float(sin(phase * frequency * 2 * .pi) * envelope * 0.15)
        }
        do {
            audioPlayer = try AVAudioPlayer(data: bufferData(buffer, format: format))
            audioPlayer?.play()
        } catch {
            audioPlayer = nil
        }
    }

    private func bufferData(_ buffer: AVAudioPCMBuffer, format: AVAudioFormat) -> Data {
        let byteCount = Int(buffer.frameLength) * Int(format.streamDescription.pointee.mBytesPerFrame)
        let samples = Data(bytes: buffer.floatChannelData![0], count: byteCount)
        var wav = Data("RIFF".utf8)
        appendLittleEndian(UInt32(36 + samples.count), to: &wav)
        wav.append(contentsOf: Data("WAVEfmt ".utf8))
        appendLittleEndian(UInt32(16), to: &wav)
        appendLittleEndian(UInt16(3), to: &wav)
        appendLittleEndian(UInt16(1), to: &wav)
        appendLittleEndian(UInt32(format.sampleRate), to: &wav)
        appendLittleEndian(UInt32(format.sampleRate * 4), to: &wav)
        appendLittleEndian(UInt16(4), to: &wav)
        appendLittleEndian(UInt16(32), to: &wav)
        wav.append(contentsOf: Data("data".utf8))
        appendLittleEndian(UInt32(samples.count), to: &wav)
        wav.append(samples)
        return wav
    }

    private func appendLittleEndian<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
        var littleEndianValue = value.littleEndian
        withUnsafeBytes(of: &littleEndianValue) { data.append(contentsOf: $0) }
    }
}
