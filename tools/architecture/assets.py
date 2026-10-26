from __future__ import annotations

from .common import *  # noqa: F403


def validate_png_asset_set(
    asset_root: Path,
    specs: dict[str, tuple[tuple[int, int], str]],
    label: str,
    root: Path = ROOT,
) -> None:

    if not asset_root.is_dir():
        fail(f"{label} asset directory missing: {relative(asset_root, root)}")
    actual_assets = {path.name for path in asset_root.iterdir() if path.is_file()}
    if actual_assets != set(specs):
        fail(f"{label} assets must contain only the approved PNGs")

    for name, (expected_dimensions, expected_digest) in specs.items():
        path = asset_root / name
        payload = path.read_bytes()
        if payload[:8] != b"\x89PNG\r\n\x1a\n":
            fail(f"{label} asset is not PNG: {relative(path, root)}")
        if len(payload) < 26:
            fail(f"{label} asset has no PNG color metadata: {relative(path, root)}")
        actual_dimensions = struct.unpack(">II", payload[16:24])
        if actual_dimensions != expected_dimensions:
            fail(
                f"{label} asset has wrong dimensions: {relative(path, root)} "
                f"({actual_dimensions}, expected {expected_dimensions})"
            )
        if hashlib.sha256(payload).hexdigest() != expected_digest:
            fail(f"{label} asset differs from supplied PNG: {relative(path, root)}")


def png_dimensions_and_alpha(path: Path, label: str, root: Path = ROOT) -> tuple[tuple[int, int], bool]:

    payload = path.read_bytes()
    if payload[:8] != b"\x89PNG\r\n\x1a\n" or len(payload) < 26:
        fail(f"{label} asset is not a complete PNG: {relative(path, root)}")
    dimensions = struct.unpack(">II", payload[16:24])
    color_type = payload[25]
    if color_type not in {0, 2, 3, 4, 6}:
        fail(f"{label} asset has an unsupported PNG color type: {relative(path, root)}")
    return dimensions, color_type in {4, 6}


def jpeg_dimensions(path: Path, label: str, root: Path = ROOT) -> tuple[int, int]:

    payload = path.read_bytes()
    if payload[:2] != b"\xff\xd8":
        fail(f"{label} asset is not a JPEG: {relative(path, root)}")
    offset = 2
    while offset + 4 <= len(payload):
        if payload[offset] != 0xFF:
            break
        marker = payload[offset + 1]
        length = struct.unpack(">H", payload[offset + 2 : offset + 4])[0]

        if 0xC0 <= marker <= 0xCF and marker not in {0xC4, 0xC8, 0xCC}:
            if offset + 9 > len(payload):
                break
            height, width = struct.unpack(">HH", payload[offset + 5 : offset + 9])
            return width, height
        offset += 2 + length
    fail(f"{label} asset is not a complete JPEG: {relative(path, root)}")


def image_dimensions_and_alpha(path: Path, label: str, root: Path = ROOT) -> tuple[tuple[int, int], bool]:

    if path.suffix.lower() in {".jpg", ".jpeg"}:
        return jpeg_dimensions(path, label, root), False
    return png_dimensions_and_alpha(path, label, root)


def png_has_huddle_mark(path: Path, label: str, root: Path = ROOT) -> bool:

    payload = path.read_bytes()
    if payload[:8] != b"\x89PNG\r\n\x1a\n":
        return False

    width = height = bit_depth = color_type = interlace = None
    image_data = bytearray()
    offset = 8
    while offset + 12 <= len(payload):
        length = struct.unpack(">I", payload[offset : offset + 4])[0]
        chunk_type = payload[offset + 4 : offset + 8]
        chunk = payload[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if chunk_type == b"IHDR" and len(chunk) >= 13:
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            interlace = chunk[12]
        elif chunk_type == b"IDAT":
            image_data.extend(chunk)
        elif chunk_type == b"IEND":
            break

    if not all(value is not None for value in (width, height, bit_depth, color_type, interlace)):
        return False
    if bit_depth != 8 or interlace != 0 or color_type not in {0, 2, 4, 6}:
        return False

    channels = {0: 1, 2: 3, 4: 2, 6: 4}[color_type]
    row_bytes = width * channels

    rows_to_scan = min(height, 1024)
    try:
        decompressor = zlib.decompressobj()
        decoded = decompressor.decompress(bytes(image_data), (row_bytes + 1) * rows_to_scan)
    except Exception:
        return False
    if len(decoded) < rows_to_scan * (row_bytes + 1):
        return False

    found = {"ink": False, "orange": False}
    previous = bytearray(row_bytes)

    def paeth(a: int, b: int, c: int) -> int:
        estimate = a + b - c
        pa = abs(estimate - a)
        pb = abs(estimate - b)
        pc = abs(estimate - c)
        if pa <= pb and pa <= pc:
            return a
        if pb <= pc:
            return b
        return c

    cursor = 0
    max_samples = 200_000
    sample_stride = max(1, (width * height) // max_samples)
    pixel_index = 0
    for _ in range(rows_to_scan):
        filter_type = decoded[cursor]
        cursor += 1
        current = bytearray(decoded[cursor : cursor + row_bytes])
        cursor += row_bytes
        if len(current) != row_bytes:
            return False
        for index, value in enumerate(current):
            left = current[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                current[index] = (value + left) & 0xFF
            elif filter_type == 2:
                current[index] = (value + above) & 0xFF
            elif filter_type == 3:
                current[index] = (value + ((left + above) // 2)) & 0xFF
            elif filter_type == 4:
                current[index] = (value + paeth(left, above, upper_left)) & 0xFF
            elif filter_type != 0:
                return False

        for x in range(width):
            if pixel_index % sample_stride:
                pixel_index += 1
                continue
            pixel_index += 1
            base = x * channels
            if color_type == 0:
                red = green = blue = current[base]
            elif color_type == 2:
                red, green, blue = current[base : base + 3]
            elif color_type == 4:
                red = green = blue = current[base]
            else:
                red, green, blue = current[base : base + 3]
            if red < 90 and green < 60 and blue > 35 and blue > red:
                found["ink"] = True
            if red > 200 and 60 < green < 150 and blue < 80:
                found["orange"] = True
            if all(found.values()):
                return True
        previous = current
    return all(found.values())


def validate_runtime_assets(root: Path = ROOT) -> None:

    for label, bundle_root, specs in RUNTIME_ASSET_BUNDLES:
        runtime_root = root / bundle_root
        if not runtime_root.is_dir():
            fail(f"{label} asset directory missing: {relative(runtime_root, root)}")

        expected_paths = set(specs)
        actual_paths = {
            str(path.relative_to(runtime_root))
            for path in runtime_root.rglob("*")
            if path.is_file()
        }
        if actual_paths != expected_paths:
            extras = sorted(actual_paths - expected_paths)
            missing = sorted(expected_paths - actual_paths)
            fail(f"{label} asset bundle is incomplete: extras={extras}, missing={missing}")

        for relative_path, (expected_dimensions, expected_alpha, expected_digest) in specs.items():
            path = runtime_root / relative_path
            dimensions, has_alpha = image_dimensions_and_alpha(path, label, root)
            if dimensions != expected_dimensions:
                fail(
                    f"{label} asset has wrong dimensions: {relative(path, root)} "
                    f"({dimensions}, expected {expected_dimensions})"
                )
            if has_alpha != expected_alpha:
                fail(
                    f"{label} asset alpha mismatch: {relative(path, root)} "
                    f"({has_alpha}, expected {expected_alpha})"
                )
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected_digest:
                fail(f"{label} asset differs from its checked-in digest: {relative(path, root)}")


def validate_reference_composite_exclusion(root: Path = ROOT) -> None:

    source_root = root / "apps" / "tv" / "src"
    if not source_root.is_dir():
        return
    for source in source_files(source_root):
        if "tv-lobby-empty.png" in source.read_text(encoding="utf-8"):
            fail(
                f"TV Room reference composite is imported at runtime: {relative(source, root)}"
            )


def validate_design_tokens(root: Path = ROOT) -> None:

    playroom_path = root / "packages" / "design-tokens" / "src" / "playroom.ts"
    if not playroom_path.is_file():
        fail(f"Playroom color token source missing: {relative(playroom_path, root)}")
    playroom_match = re.search(
        r"export const playroomColors = \{(?P<body>.*?)\}\s+as const;",
        playroom_path.read_text(encoding="utf-8"),
        re.DOTALL,
    )
    if playroom_match is None:
        fail("Playroom color token map is missing")
    playroom = dict(re.findall(r"^\s*([A-Za-z][A-Za-z0-9]*):\s*['\"](#[0-9A-Fa-f]{6})['\"]", playroom_match.group("body"), re.MULTILINE))
    if playroom != PLAYROOM_PALETTE:
        fail(f"Playroom palette differs from the approved design: {playroom}")

    hex_literal = re.compile(r"#[0-9A-Fa-f]{6}")
    approved_hexes = set(PLAYROOM_PALETTE.values())
    for base in (root / "apps", root / "games", root / "packages" / "ui"):
        for path in source_files(base):
            if path == playroom_path or ".test." in path.name:
                continue
            clean = COMMENTS.sub("", path.read_text(encoding="utf-8"))
            literals = {value.upper() for value in hex_literal.findall(clean)}
            allowed = approved_hexes
            if path.is_relative_to(root / "games" / "trivia"):
                allowed = approved_hexes | set(COSMIC_QUIZ_PALETTE.values())
            if path.is_relative_to(root / "games" / "bomb-squad"):
                allowed = approved_hexes | set(BOMB_SQUAD_PALETTE.values())
            if path.is_relative_to(root / "games" / "sumo-bumpers"):
                allowed = approved_hexes | set(SUMO_BUMPERS_PALETTE.values())
            if not literals.issubset(allowed):
                fail(f"unapproved color literal in screen source: {relative(path, root)}")
