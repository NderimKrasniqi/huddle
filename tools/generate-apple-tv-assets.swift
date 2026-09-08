import AppKit
import CoreText
import Foundation

// Deterministically composes the TV identity derivatives from the current
// temporary Huddle launcher mark, Nunito ExtraBold, and Heartbeat TV stage
// artwork. This is intentionally a native CoreGraphics/AppKit compositor
// rather than an AI or raster-redraw step. Android TV and Apple TV share the
// same identity rules; only the required canvas and lockup treatment differ.

let generatorArguments = Array(CommandLine.arguments.dropFirst())
let topShelfOnly = generatorArguments.contains("--top-shelf-only")
let repositoryRoot = URL(
    fileURLWithPath: generatorArguments.first(where: { !$0.hasPrefix("--") })
        ?? FileManager.default.currentDirectoryPath,
    isDirectory: true
)

let appIconRoot = repositoryRoot
    .appendingPathComponent("packages/ui/assets/app-icons", isDirectory: true)
let appleTVRoot = appIconRoot.appendingPathComponent("apple-tv", isDirectory: true)
let platformStageURL = repositoryRoot
    .appendingPathComponent("packages/ui/assets/heartbeat/tv/platform-stage.png")
let glossyMarkURL = repositoryRoot
    .appendingPathComponent("packages/ui/assets/heartbeat/brand/huddle-launcher-mark.png")
let fontURL = repositoryRoot
    .appendingPathComponent("apps/phone/node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf")

guard let platformStage = NSImage(contentsOf: platformStageURL),
      let glossyMark = NSImage(contentsOf: glossyMarkURL) else {
    fputs("Unable to load the Heartbeat TV stage or glossy Huddle launcher mark.\n", stderr)
    exit(1)
}

var fontRegistrationError: Unmanaged<CFError>?
guard CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &fontRegistrationError) else {
    if let fontRegistrationError {
        fputs("Unable to load Nunito ExtraBold: \(fontRegistrationError.takeRetainedValue()).\n", stderr)
    } else {
        fputs("Unable to load Nunito ExtraBold from \(fontURL.path).\n", stderr)
    }
    exit(1)
}

let fontName = "Nunito-ExtraBold"
let fontProbe = CTFontCreateWithName(fontName as CFString, 12, nil)
guard String(CTFontCopyPostScriptName(fontProbe)) == fontName,
      CTFontGetGlyphCount(fontProbe) > 0 else {
    fputs("Registered Nunito ExtraBold did not expose the expected font face.\n", stderr)
    exit(1)
}

try FileManager.default.createDirectory(at: appIconRoot, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: appleTVRoot, withIntermediateDirectories: true)

let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, alpha: CGFloat = 1) -> CGColor {
    CGColor(colorSpace: colorSpace, components: [red, green, blue, alpha])!
}

let cream = color(249 / 255, 241 / 255, 230 / 255)
let espresso = color(43 / 255, 31 / 255, 23 / 255)

func drawImageAspectFill(_ image: NSImage, in rect: CGRect, context: CGContext) {
    let sourceSize = image.size
    let scale = max(rect.width / sourceSize.width, rect.height / sourceSize.height)
    let drawnSize = CGSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
    let drawnRect = CGRect(
        x: rect.midX - drawnSize.width / 2,
        y: rect.midY - drawnSize.height / 2,
        width: drawnSize.width,
        height: drawnSize.height
    )

    context.saveGState()
    context.addRect(rect)
    context.clip()
    let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphicsContext
    image.draw(
        in: NSRect(x: drawnRect.minX, y: drawnRect.minY, width: drawnRect.width, height: drawnRect.height),
        from: NSRect(origin: .zero, size: sourceSize),
        operation: .sourceOver,
        fraction: 1
    )
    NSGraphicsContext.restoreGraphicsState()
    context.restoreGState()
}

func drawImage(_ image: NSImage, in rect: CGRect, context: CGContext) {
    let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphicsContext
    image.draw(
        in: NSRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height),
        from: NSRect(origin: .zero, size: image.size),
        operation: .sourceOver,
        fraction: 1
    )
    NSGraphicsContext.restoreGraphicsState()
}

func wordmarkLine(fontSize: CGFloat) -> CTLine {
    let font = CTFontCreateWithName(fontName as CFString, fontSize, nil)
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): cream
    ]
    return CTLineCreateWithAttributedString(
        NSAttributedString(string: "Huddle", attributes: attributes)
    )
}

func wordmarkWidth(_ line: CTLine) -> CGFloat {
    var ascent: CGFloat = 0
    var descent: CGFloat = 0
    var leading: CGFloat = 0
    return CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, &leading))
}

func drawWordmark(_ line: CTLine, centeredAt center: CGPoint, context: CGContext) {
    var ascent: CGFloat = 0
    var descent: CGFloat = 0
    var leading: CGFloat = 0
    let width = wordmarkWidth(line)
    _ = CTLineGetTypographicBounds(line, &ascent, &descent, &leading)

    context.saveGState()
    context.textPosition = CGPoint(
        x: center.x - width / 2,
        y: center.y - (ascent - descent) / 2
    )
    CTLineDraw(line, context)
    context.restoreGState()
}

func drawLockup(
    size: CGSize,
    center: CGPoint,
    markHeight: CGFloat,
    wordmarkScale: CGFloat,
    context: CGContext
) {
    let sourceAspect = glossyMark.size.width / glossyMark.size.height
    let markWidth = markHeight * sourceAspect
    let fontSize = markHeight * wordmarkScale
    let line = wordmarkLine(fontSize: fontSize)
    let gap = fontSize * 0.34
    let totalWidth = markWidth + gap + wordmarkWidth(line)
    let startX = center.x - totalWidth / 2

    drawImage(
        glossyMark,
        in: CGRect(
            x: startX,
            y: center.y - markHeight / 2,
            width: markWidth,
            height: markHeight
        ),
        context: context
    )
    drawWordmark(
        line,
        centeredAt: CGPoint(x: startX + markWidth + gap + wordmarkWidth(line) / 2, y: center.y),
        context: context
    )
}

func drawPlatformStageBackground(size: CGSize, context: CGContext) {
    drawImageAspectFill(
        platformStage,
        in: CGRect(origin: .zero, size: size),
        context: context
    )

    // The gradient is a smooth readability field, not a card or framed panel.
    let leftGradient = CGGradient(
        colorsSpace: colorSpace,
        colors: [
            espresso.copy(alpha: 0.88)!,
            espresso.copy(alpha: 0.66)!,
            espresso.copy(alpha: 0.28)!,
            espresso.copy(alpha: 0)!
        ] as CFArray,
        locations: [0, 0.34, 0.68, 1]
    )!
    context.drawLinearGradient(
        leftGradient,
        start: CGPoint(x: 0, y: size.height / 2),
        end: CGPoint(x: size.width * 0.78, y: size.height / 2),
        options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
    )
}

func drawAndroidTVIcon(size: CGSize, context: CGContext) {
    // Android TV launchers use the mark alone on a calm espresso field.
    let markHeight = min(size.width, size.height) * 0.58
    let markWidth = markHeight * glossyMark.size.width / glossyMark.size.height
    drawImage(
        glossyMark,
        in: CGRect(
            x: (size.width - markWidth) / 2,
            y: (size.height - markHeight) / 2,
            width: markWidth,
            height: markHeight
        ),
        context: context
    )
}

func drawAndroidTVBanner(size: CGSize, context: CGContext) {
    // The 10% overscan margin is applied to the complete unboxed lockup.
    drawLockup(
        size: size,
        center: CGPoint(x: size.width / 2, y: size.height / 2),
        markHeight: size.height * 0.48,
        wordmarkScale: 0.45,
        context: context
    )
}

func drawAppleTVIcon(size: CGSize, context: CGContext) {
    drawLockup(
        size: size,
        center: CGPoint(x: size.width / 2, y: size.height / 2),
        markHeight: size.height * 0.42,
        wordmarkScale: 0.45,
        context: context
    )
}

func drawAppleTVTopShelf(size: CGSize, context: CGContext) {
    drawPlatformStageBackground(size: size, context: context)
    drawLockup(
        size: size,
        center: CGPoint(x: size.width * 0.29, y: size.height * 0.52),
        markHeight: size.height * 0.32,
        wordmarkScale: 0.45,
        context: context
    )
}

struct Output {
    let filename: String
    let size: CGSize
    let renderer: (CGSize, CGContext) -> Void
}

let outputs = [
    Output(filename: "huddle-android-tv-icon.png", size: CGSize(width: 1024, height: 1024), renderer: drawAndroidTVIcon),
    Output(filename: "huddle-android-tv-banner.png", size: CGSize(width: 640, height: 360), renderer: drawAndroidTVBanner),
    Output(filename: "apple-tv/huddle-tv-icon-1280x768.png", size: CGSize(width: 1280, height: 768), renderer: drawAppleTVIcon),
    Output(filename: "apple-tv/huddle-tv-icon-400x240.png", size: CGSize(width: 400, height: 240), renderer: drawAppleTVIcon),
    Output(filename: "apple-tv/huddle-tv-icon-800x480.png", size: CGSize(width: 800, height: 480), renderer: drawAppleTVIcon),
    Output(filename: "apple-tv/huddle-tv-top-shelf-1920x720.png", size: CGSize(width: 1920, height: 720), renderer: drawAppleTVTopShelf),
    Output(filename: "apple-tv/huddle-tv-top-shelf-3840x1440.png", size: CGSize(width: 3840, height: 1440), renderer: drawAppleTVTopShelf),
    Output(filename: "apple-tv/huddle-tv-top-shelf-wide-2320x720.png", size: CGSize(width: 2320, height: 720), renderer: drawAppleTVTopShelf),
    Output(filename: "apple-tv/huddle-tv-top-shelf-wide-4640x1440.png", size: CGSize(width: 4640, height: 1440), renderer: drawAppleTVTopShelf)
]

let selectedOutputs = outputs.filter { !topShelfOnly || $0.filename.contains("top-shelf") }

for output in selectedOutputs {
    let width = Int(output.size.width)
    let height = Int(output.size.height)
    let bitmapInfo = CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo
    ) else {
        fputs("Unable to allocate \(output.filename).\n", stderr)
        exit(1)
    }

    context.interpolationQuality = CGInterpolationQuality.high
    context.setFillColor(espresso)
    context.fill(CGRect(origin: .zero, size: output.size))
    output.renderer(output.size, context)

    guard let cgImage = context.makeImage() else {
        fputs("Unable to encode \(output.filename).\n", stderr)
        exit(1)
    }
    let bitmap = NSBitmapImageRep(cgImage: cgImage)
    guard let png = bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else {
        fputs("Unable to encode \(output.filename).\n", stderr)
        exit(1)
    }
    let destination = appIconRoot.appendingPathComponent(output.filename)
    try png.write(to: destination)
    print("Generated \(destination.path) (\(width)x\(height))")
}
