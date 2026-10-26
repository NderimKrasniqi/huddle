#!/usr/bin/env python3
from __future__ import annotations

from architecture.boundaries import validate_app, validate_package_boundaries, validate_room_host, validate_web_tv_portability
from architecture.common import APP_NAMES, ROOT
from architecture.stack import validate_stack


def main() -> int:
    for name in APP_NAMES:
        validate_app(ROOT / "apps" / name)
    validate_package_boundaries(ROOT)
    validate_room_host(ROOT)
    validate_web_tv_portability(ROOT)
    validate_stack(ROOT)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
