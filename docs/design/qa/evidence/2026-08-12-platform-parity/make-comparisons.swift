import AppKit
import Foundation

struct Pair {
  let output: String
  let reference: String
  let current: String
  let currentLabel: String
  let canvas: NSSize
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let evidence = root.appendingPathComponent("docs/design/qa/evidence/2026-08-12-platform-parity")
let references = root.appendingPathComponent("docs/design/reference/screens")

let phoneCanvas = NSSize(width: 1800, height: 1120)
let tvCanvas = NSSize(width: 1800, height: 650)

let pairs = [
  Pair(output: "phone-01-join.png", reference: "01-join-room.png", current: "raw/phone/03-join-code-ready.png", currentLabel: "RELEASE · IPHONE 17 · CODE READY", canvas: phoneCanvas),
  Pair(output: "phone-02-host-room.png", reference: "02-your-room-host.png", current: "raw/phone/07-host-room.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-03-manage-player.png", reference: "03-manage-player-host.png", current: "raw/phone/08-manage-away.png", currentLabel: "RELEASE · IPHONE 17 · AWAY", canvas: phoneCanvas),
  Pair(output: "phone-04-game-picker.png", reference: "04-pick-a-game-host.png", current: "raw/phone/11-game-picker.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-05-player-waiting.png", reference: "05-waiting-player.png", current: "raw/phone/06-player-waiting.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-06-settings-standard.png", reference: "06-game-settings-host-standard.png", current: "raw/phone/12-settings-standard.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-07-settings-quick.png", reference: "07-game-settings-host-quick.png", current: "raw/phone/13-settings-quick.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-08-settings-custom.png", reference: "08-game-settings-host-custom.png", current: "raw/phone/14-settings-custom.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-09-finished-player.png", reference: "09-game-finished-player.png", current: "raw/phone/19-finished-player.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "phone-10-finished-host.png", reference: "10-game-finished-host.png", current: "raw/phone/18-finished-host.png", currentLabel: "RELEASE · IPHONE 17", canvas: phoneCanvas),
  Pair(output: "tv-01-room.png", reference: "01-room.png", current: "raw/tv/04-room-two-online.png", currentLabel: "RELEASE · APPLE TV 4K · 1080P", canvas: tvCanvas),
  Pair(output: "tv-02-game-carousel.png", reference: "02-game-carousel.png", current: "raw/tv/06-game-carousel.png", currentLabel: "RELEASE · APPLE TV 4K · 1080P", canvas: tvCanvas),
  Pair(output: "tv-03-game-setup.png", reference: "03-game-setup.png", current: "raw/tv/07-game-setup-standard.png", currentLabel: "RELEASE · APPLE TV 4K · 1080P", canvas: tvCanvas),
]

func fittedRect(imageSize: NSSize, in bounds: NSRect) -> NSRect {
  let scale = min(bounds.width / imageSize.width, bounds.height / imageSize.height)
  let size = NSSize(width: imageSize.width * scale, height: imageSize.height * scale)
  return NSRect(
    x: bounds.midX - size.width / 2,
    y: bounds.midY - size.height / 2,
    width: size.width,
    height: size.height
  )
}

func drawLabel(_ text: String, in rect: NSRect) {
  let style = NSMutableParagraphStyle()
  style.alignment = .center
  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 21, weight: .semibold),
    .foregroundColor: NSColor(calibratedRed: 0.055, green: 0.10, blue: 0.18, alpha: 1),
    .paragraphStyle: style,
    .kern: 1.2,
  ]
  (text as NSString).draw(in: rect, withAttributes: attributes)
}

func render(_ pair: Pair) throws {
  guard let reference = NSImage(contentsOf: references.appendingPathComponent(pair.reference)),
        let current = NSImage(contentsOf: evidence.appendingPathComponent(pair.current)) else {
    throw NSError(domain: "comparison", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not load \(pair.output)"])
  }

  let canvas = NSImage(size: pair.canvas)
  canvas.lockFocus()
  NSColor(calibratedRed: 0.965, green: 0.949, blue: 0.925, alpha: 1).setFill()
  NSRect(origin: .zero, size: pair.canvas).fill()

  let outer: CGFloat = 28
  let gutter: CGFloat = 24
  let labelHeight: CGFloat = 42
  let panelWidth = (pair.canvas.width - outer * 2 - gutter) / 2
  let panelHeight = pair.canvas.height - outer * 2
  let left = NSRect(x: outer, y: outer, width: panelWidth, height: panelHeight)
  let right = NSRect(x: outer + panelWidth + gutter, y: outer, width: panelWidth, height: panelHeight)

  for panel in [left, right] {
    NSColor.white.setFill()
    NSBezierPath(roundedRect: panel, xRadius: 18, yRadius: 18).fill()
  }

  let imageInset: CGFloat = 18
  let leftImageBounds = NSRect(x: left.minX + imageInset, y: left.minY + imageInset, width: left.width - imageInset * 2, height: left.height - labelHeight - imageInset * 2)
  let rightImageBounds = NSRect(x: right.minX + imageInset, y: right.minY + imageInset, width: right.width - imageInset * 2, height: right.height - labelHeight - imageInset * 2)
  reference.draw(in: fittedRect(imageSize: reference.size, in: leftImageBounds), from: .zero, operation: .sourceOver, fraction: 1)
  current.draw(in: fittedRect(imageSize: current.size, in: rightImageBounds), from: .zero, operation: .sourceOver, fraction: 1)
  drawLabel("APPROVED REFERENCE · FULL EXPORT", in: NSRect(x: left.minX, y: left.maxY - labelHeight - 6, width: left.width, height: labelHeight))
  drawLabel(pair.currentLabel, in: NSRect(x: right.minX, y: right.maxY - labelHeight - 6, width: right.width, height: labelHeight))
  canvas.unlockFocus()

  guard let tiff = canvas.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "comparison", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not encode \(pair.output)"])
  }
  let destination = evidence.appendingPathComponent("comparisons").appendingPathComponent(pair.output)
  try png.write(to: destination)
}

try FileManager.default.createDirectory(at: evidence.appendingPathComponent("comparisons"), withIntermediateDirectories: true)
for pair in pairs {
  try render(pair)
  print(pair.output)
}
