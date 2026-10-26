from __future__ import annotations

from .common import *  # noqa: F403


def validate_presentation_renderer_scope(
    source: Path, clean_source: str, root: Path = ROOT
) -> None:

    resolved = source.resolve()
    svg_renderers = {(root / renderer).resolve() for renderer in TV_SVG_RENDERERS}
    room_renderer = (root / TV_ROOM_RENDERER).resolve()
    scan_renderer = (root / PHONE_SCAN_RENDERER).resolve()

    if re.search(r"\b(?:react-native-qrcode-svg|QRCode)\b", clean_source) and resolved != room_renderer:
        fail(f"QR renderer is outside TV Room: {relative(source, root)}")
    if re.search(r"\bCameraView\b", clean_source) and resolved != scan_renderer:
        fail(f"CameraView is outside Phone Scan: {relative(source, root)}")
    if re.search(r"\breact-native-svg\b", clean_source) and resolved not in svg_renderers:
        fail(f"SVG renderer import is outside approved TV renderers: {relative(source, root)}")


def tv_presentation_sources(root: Path = ROOT) -> list[Path]:

    sources = source_files(root / "apps" / "tv" / "src") if (root / "apps" / "tv" / "src").is_dir() else []
    for game in ("trivia", "bomb-squad", "sumo-bumpers"):
        path = root / "games" / game / "src" / "tv-screen.tsx"
        if path.is_file():
            sources.append(path)
    return sorted(set(sources))


def validate_tv_display_only(root: Path = ROOT) -> None:

    for source in tv_presentation_sources(root):
        clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))
        match = TV_CONTROL_REFERENCE.search(clean)
        if match:
            fail(f"TV presentation must remain display-only: {relative(source, root)}")


def validate_route_adapters(app: Path, root: Path = ROOT) -> None:
    app = app.resolve()
    for route in sorted((app / "app").rglob("*.tsx")):
        if route.name == "_layout.tsx":
            continue

        source = route.read_text(encoding="utf-8")
        exports = list(ROUTE_EXPORT.finditer(source))
        if len(exports) != 1:
            fail(f"route adapter must re-export exactly one screen: {relative(route, root)}")

        authored = COMMENTS.sub("", ROUTE_EXPORT.sub("", source))
        if authored.strip():
            fail(f"route adapter contains implementation: {relative(route, root)}")

        target = resolve_import(route, exports[0].group("path"))
        src = (app / "src").resolve()
        if target is None or not target.is_relative_to(src):
            fail(f"route adapter bypasses src ownership: {relative(route, root)}")


def validate_filename_conventions(app: Path, root: Path = ROOT) -> None:
    src = (app / "src").resolve()
    for directory in sorted(path for path in src.rglob("*") if path.is_dir()):
        if directory.name.startswith("_"):
            continue
        if not KEBAB_DIR.fullmatch(directory.name):
            fail(f"authored directory must be kebab-case: {relative(directory, root)}")

    for path in source_files(src):
        if path.name.startswith("_") or not KEBAB_FILE.fullmatch(path.name):
            fail(f"authored filename must be kebab-case: {relative(path, root)}")
        if ".web." in path.name and not path.is_relative_to(root / "apps" / "tv" / "src" / "platform"):
            fail(f"a .web file belongs in the TV platform layer: {relative(path, root)}")


def validate_entrypoint_content(app: Path, root: Path = ROOT) -> None:
    src = (app / "src").resolve()
    owners = [
        *(Owner("feature", module.name, module) for module in sorted((src / "features").iterdir()) if module.is_dir()),
        *(Owner("platform", module.name, module) for module in sorted((src / "platform").iterdir()) if module.is_dir()),
    ]
    for owner in owners:
        index = owner.root / "index.ts"
        native = owner.root / "native.ts"
        if not index.is_file() and not native.is_file():
            fail(f"owner has no public entrypoint: {relative(owner.root, root)}")
        for entrypoint in (index, native):
            if not entrypoint.is_file():
                continue
            source = COMMENTS.sub("", entrypoint.read_text(encoding="utf-8")).strip()
            if not source:
                fail(f"empty public entrypoint: {relative(entrypoint, root)}")

            session_index = src / "platform" / "session" / "index.ts"
            if entrypoint.name == "index.ts" and entrypoint != session_index and RENDERER_IMPORT.search(source):
                fail(f"pure entrypoint imports renderer code: {relative(entrypoint, root)}")

            if entrypoint.name == "index.ts" and entrypoint != session_index:
                validate_transitive_renderer_free(entrypoint, root, "pure entrypoint")

    for models in (src / "models",):
        if not models.is_dir():
            fail(f"missing app models layer: {relative(models, root)}")
        for path in source_files(models):
            if renderer_import(COMMENTS.sub("", path.read_text(encoding="utf-8"))):
                fail(f"model entrypoint exposes renderer code: {relative(path, root)}")

    ui = src / "ui"
    if not (ui / "index.ts").is_file():
        fail(f"missing public UI entrypoint: {relative(ui / 'index.ts', root)}")


def validate_transitive_renderer_free(entrypoint: Path, root: Path, label: str) -> None:

    pending = [entrypoint]
    visited: set[Path] = set()
    while pending:
        source = pending.pop()
        if source in visited or not source.is_file():
            continue
        visited.add(source)
        text = COMMENTS.sub("", source.read_text(encoding="utf-8"))
        if renderer_import(text):
            fail(f"{label} transitively imports renderer code: {relative(source, root)}")
        for match in runtime_module_references(text):
            target = resolve_import(source, match.group("path"))
            if target is not None:
                pending.append(target)


def validate_package_boundaries(root: Path = ROOT) -> None:

    manifests = package_manifests(root)
    by_name: dict[str, Path] = {}
    payloads: dict[Path, dict[str, object]] = {}
    for manifest in manifests:
        try:
            payload = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            fail(f"invalid package manifest: {relative(manifest, root)} ({error})")
        if not isinstance(payload, dict):
            fail(f"package manifest must be an object: {relative(manifest, root)}")
        payloads[manifest] = payload
        name = payload.get("name")
        if isinstance(name, str):
            by_name[name] = manifest

        exports = payload.get("exports")
        if exports is not None:
            for target in export_values(exports):
                if not target.startswith("."):
                    continue
                resolved = manifest.parent / target
                if "*" in target:
                    resolved = Path(str(resolved).split("*", 1)[0])
                if not resolved.exists():
                    fail(
                        f"package export target missing: {relative(manifest, root)} -> {target}"
                    )

    allowed: dict[str, set[str]] = {
        "app": {"contracts", "domain", "tokens", "registry", "game", "ui", "host"},
        "registry": {"contracts", "domain", "game"},
        "game": {"contracts", "domain", "tokens", "ui", "physics"},
        "physics": set(),
        "host": {"contracts", "domain", "registry"},
        "ui": {"contracts", "tokens"},
        "domain": {"contracts"},
        "contracts": set(),
        "tokens": set(),
        "package": set(),
        "root": {"app", "contracts", "domain", "tokens", "registry", "game", "ui", "physics", "host", "package"},
    }
    for manifest, payload in payloads.items():
        source_kind = package_kind(manifest, root)
        dependencies: dict[str, object] = {}
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            value = payload.get(field)
            if isinstance(value, dict):
                dependencies.update(value)
        for dependency, version in dependencies.items():
            if not isinstance(version, str) or not version.startswith("workspace:"):
                continue
            target_manifest = by_name.get(dependency)
            if target_manifest is None:
                fail(
                    f"workspace dependency has no package: {relative(manifest, root)} -> {dependency}"
                )
            target_kind = package_kind(target_manifest, root)
            if target_kind not in allowed.get(source_kind, set()):
                fail(
                    f"forbidden workspace dependency direction: {relative(manifest, root)} -> {dependency}"
                )

    for manifest, payload in payloads.items():
        exports = payload.get("exports")
        if not isinstance(exports, dict):
            continue
        for key, declaration in exports.items():
            if not isinstance(key, str) or key == ".":
                continue
            targets = export_values(declaration)
            is_rules = key in {"./logic", "./rules"} or key.endswith("/logic")
            is_client_safe = "client" in key or key.endswith("/categories")
            if not (is_rules or is_client_safe):
                continue
            for target in targets:
                if not target.startswith("."):
                    continue
                entrypoint = manifest.parent / target
                if is_rules:
                    validate_transitive_renderer_free(entrypoint, root, "rules-only entrypoint")
                if is_client_safe:
                    pending = [entrypoint]
                    visited: set[Path] = set()
                    while pending:
                        source = pending.pop()
                        if source in visited or not source.is_file():
                            continue
                        visited.add(source)
                        text = COMMENTS.sub("", source.read_text(encoding="utf-8"))
                        if SERVER_CONTENT_IMPORT.search(text):
                            fail(
                                f"client-safe entrypoint reaches server/content code: {relative(source, root)}"
                            )
                        for match in runtime_module_references(text):
                            child = resolve_import(source, match.group("path"))
                            if child is not None:
                                pending.append(child)


def allowed_cross_boundary(source_owner: Owner, target_owner: Owner, target: Path) -> bool:
    if source_owner == target_owner:
        return True
    if source_owner.kind == "models":
        return False
    if source_owner.kind == "ui":
        return target_owner.kind == "ui"
    if source_owner.kind == "screens":
        if target_owner.kind == "ui" and target.name == "reduced-motion.ts":
            return True
        if target_owner.kind == "feature" and target.name in {
            "join-entry.ts",
            "join-rejection.ts",
            "identity.ts",
            "room-code-entry.tsx",
            "settings-choice.ts",
        }:
            return True
        if target_owner.kind == "models" and target.name == "lifecycle-rejection.ts":
            return True
        return target_owner.kind in {"feature", "platform", "models", "ui"} and is_entrypoint(
            target, target_owner
        )
    if source_owner.kind == "feature":
        if target_owner.kind == "ui" and target.name == "reduced-motion.ts":
            return True
        return target_owner.kind in {"platform", "models", "ui"} and is_entrypoint(
            target, target_owner
        )
    if source_owner.kind == "platform":
        return target_owner.kind in {"platform", "models"} and is_entrypoint(target, target_owner)
    return False


def validate_dependency_direction(app: Path, root: Path = ROOT) -> None:
    src = (app / "src").resolve()
    owners = [
        *(Owner("feature", module.name, module) for module in sorted((src / "features").iterdir()) if module.is_dir()),
        *(Owner("platform", module.name, module) for module in sorted((src / "platform").iterdir()) if module.is_dir()),
        Owner("models", "models", src / "models"),
        Owner("ui", "ui", src / "ui"),
        Owner("screens", "screens", src / "screens"),
    ]
    graph: dict[Path, set[Path]] = {path: set() for path in source_files(src)}

    def find_owner(path: Path) -> Owner | None:
        return next((owner for owner in owners if path.is_relative_to(owner.root)), None)

    for source in graph:
        source_owner = find_owner(source)
        if source_owner is None:
            continue
        text = source.read_text(encoding="utf-8")
        for match in runtime_module_references(text):
            target = resolve_import(source, match.group("path"))
            if target is None or not target.is_relative_to(src):
                continue
            graph[source].add(target)
            target_owner = find_owner(target)
            if target_owner is None or target_owner == source_owner:
                continue
            if not allowed_cross_boundary(source_owner, target_owner, target):
                fail(
                    f"forbidden dependency direction: {relative(source, root)} -> {match.group('path')}"
                )

    visiting: set[Path] = set()
    visited: set[Path] = set()

    def visit(node: Path) -> None:
        if node in visiting:
            fail(f"dependency cycle detected at: {relative(node, root)}")
        if node in visited:
            return
        visiting.add(node)
        for child in graph[node]:
            if child in graph:
                visit(child)
        visiting.remove(node)
        visited.add(node)

    for source in graph:
        visit(source)


def validate_public_entrypoints(app: Path, root: Path = ROOT) -> None:

    validate_entrypoint_content(app, root)


def validate_cross_boundary_imports(app: Path, root: Path = ROOT) -> None:

    validate_dependency_direction(app, root)


def validate_app(app: Path, root: Path = ROOT) -> None:
    validate_route_adapters(app, root)
    validate_filename_conventions(app, root)
    validate_public_entrypoints(app, root)
    validate_cross_boundary_imports(app, root)


def validate_qr_dependency_scope(root: Path = ROOT) -> None:

    tv_manifest = (root / "apps" / "tv" / "package.json").resolve()
    found_on_tv: dict[str, str] = {}
    for manifest in package_manifests(root):
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            declared = payload.get(field, {})
            if not isinstance(declared, dict):
                continue
            for dependency, expected_version in TV_QR_DEPENDENCIES.items():
                if dependency not in declared:
                    continue
                if manifest.resolve() != tv_manifest or field != "dependencies":
                    fail(
                        f"QR/SVG dependency is outside the TV renderer: "
                        f"{relative(manifest, root)} -> {dependency}"
                    )
                actual_version = declared[dependency]
                if actual_version != expected_version:
                    fail(
                        f"TV QR/SVG dependency has wrong version: {dependency} "
                        f"({actual_version}, expected {expected_version})"
                    )
                found_on_tv[dependency] = str(actual_version)

    missing = set(TV_QR_DEPENDENCIES).difference(found_on_tv)
    if missing:
        fail(f"TV QR/SVG dependency missing: {sorted(missing)[0]}")


def validate_room_host(root: Path = ROOT) -> None:

    src = root / "packages" / "room-host" / "src"
    if not src.is_dir():
        fail("missing room host package: packages/room-host/src")
    for source in source_files(src):
        clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))
        for match in MODULE_REFERENCE.finditer(clean):
            if not ROOM_HOST_ALLOWED_IMPORT.match(match.group("path")):
                fail(f"room host imports {match.group('path')}: {relative(source, root)}")
        strings = re.sub(r"(['\"`])(?:\\.|(?!\1).)*\1", "''", clean)
        global_use = ROOM_HOST_PLATFORM_GLOBAL.search(strings)
        if global_use:
            fail(f"room host uses the platform global {global_use.group(0)}: {relative(source, root)}")
    validate_transitive_renderer_free(src / "index.ts", root, "room host")
    validate_transitive_renderer_free(root / "packages" / "contracts" / "src" / "protocol.ts", root, "room protocol")


def validate_web_tv_portability(root: Path = ROOT) -> None:

    tv_src = root / "apps" / "tv" / "src"
    platform = tv_src / "platform"
    shared_tv = [path for path in source_files(tv_src) if not path.is_relative_to(platform)]
    shared_tv += [path for path in tv_presentation_sources(root) if not path.is_relative_to(tv_src)]
    for source in shared_tv:
        clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))
        match = TV_NATIVE_ONLY_IMPORT.search(clean)
        if match:
            fail(f"shared TV code reaches native-only {match.group(0).strip(chr(39) + chr(34))}; move it behind apps/tv/src/platform: {relative(source, root)}")

    for base in (root / "apps", root / "packages"):
        for source in source_files(base):
            if "metro-stubs" in source.parts:
                continue
            if SKIA_IMPORT.search(COMMENTS.sub("", source.read_text(encoding="utf-8"))):
                fail(f"Skia belongs inside a game package, behind its alias: {relative(source, root)}")
