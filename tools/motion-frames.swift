// Pull frames, with their timestamps, out of a simulator recording.
//
// The two Soft Minimal animations run in 250ms and 300ms, and `simctl io
// screenshot` takes longer than either of them to return a single frame — so an
// animation cannot be watched the way the design-fidelity captures watch a
// screen. `simctl io <udid> recordVideo` can: it records the simulator at 60fps.
// This reads that recording back a frame at a time and writes the ones inside a
// window as PNGs, named by their real presentation time.
//
// Swift rather than Python because AVFoundation is already on the machine that
// has the simulators, and this repo has no ffmpeg.
//
// It decodes the track from the start with `AVAssetReader` rather than seeking
// with `AVAssetImageGenerator`, which is not a detail: a recording that was
// interrupted (which is the only way `recordVideo` ever ends) has an index that
// stops before its samples do, and the generator answers every seek past that
// point with the same last frame it can find. Reading the track through returns
// what was actually recorded.
//
// Usage:
//
//     swift tools/motion-frames.swift <movie> <out-dir> <prefix> <from-ms> <to-ms>
//
// Prints one line per frame in the recording, and writes `<out-dir>/<prefix>-NN
// -<ms>.png` for the ones inside the window. Every frame is printed whether or
// not it is written, so an empty window (`0 -1`) lists the recording and saves
// nothing — which is how to find the burst worth cropping. That listing is the
// tool's first job and not a side effect: the recorder writes frames only while
// the screen is changing, so where the timestamps bunch up is where the
// animation is.

import AVFoundation
import CoreImage
import Foundation

let arguments = CommandLine.arguments

guard arguments.count == 6,
      let fromMs = Double(arguments[4]),
      let toMs = Double(arguments[5])
else {
    FileHandle.standardError.write(
        Data("usage: motion-frames.swift <movie> <out-dir> <prefix> <from-ms> <to-ms>\n".utf8)
    )
    exit(2)
}

let movie = URL(fileURLWithPath: arguments[1])
let outDir = URL(fileURLWithPath: arguments[2])
let prefix = arguments[3]

let asset = AVURLAsset(url: movie)

guard let track = asset.tracks(withMediaType: .video).first,
      let reader = try? AVAssetReader(asset: asset)
else {
    FileHandle.standardError.write(Data("no video track in \(movie.path)\n".utf8))
    exit(1)
}

let output = AVAssetReaderTrackOutput(
    track: track,
    outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
)
reader.add(output)
reader.startReading()

let context = CIContext()
var frames = 0
var written = 0

while let sample = output.copyNextSampleBuffer() {
    frames += 1

    let ms = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample)) * 1000

    guard ms >= fromMs, ms <= toMs, let buffer = CMSampleBufferGetImageBuffer(sample) else {
        print(String(format: "%9.1fms", ms))
        continue
    }

    written += 1
    let name = String(format: "%@-%02d-%.0fms.png", prefix, written, ms)

    do {
        try context.writePNGRepresentation(
            of: CIImage(cvPixelBuffer: buffer),
            to: outDir.appendingPathComponent(name),
            format: .RGBA8,
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )
        print(String(format: "%9.1fms  %@", ms, name))
    } catch {
        FileHandle.standardError.write(Data("\(name): \(error)\n".utf8))
        exit(1)
    }
}

print(String(format: "%d frames in the recording, %d written", frames, written))
