# Dependency security

Last reviewed: 2026-08-13. Review again on the next Expo SDK or Metro upgrade,
or by 2026-11-13, whichever comes first.

Production dependency audits run with:

```sh
pnpm audit:prod
pnpm verify:dependency-security
```

## Pinned transitive fixes

The workspace overrides vulnerable transitive ranges with the smallest compatible
patched releases used by the current Expo and tooling graph:

| Package | Resolved version | Advisory |
| --- | --- | --- |
| `brace-expansion` | `5.0.9` | `GHSA-rgw5-rvv9-x895` |
| `js-yaml` | `4.3.1` | `GHSA-5p4m-2wfm-xmqj` |
| `nanoid` | `3.3.18` | `GHSA-2v37-7h3g-55p8` |
| `uuid` | `11.1.1` | `GHSA-w5hq-g745-h8pq` |

`uuid` is pinned to the final CommonJS-compatible major used by `xcode@3.0.1`.
Its `v4()` API remains available and is covered by the dependency verification
smoke check.

## Locally patched image parser

Metro currently resolves `image-size@1.2.1`. The registry reports no patched
release for these denial-of-service advisories:

- `CVE-2025-71330` / `GHSA-w3rx-r6r6-pgpr` — a zero-length ICNS entry can stall
  the parser.
- `CVE-2025-71329` / `GHSA-5p2g-fcmc-qvqq` — a zero-length JXL or HEIF box can
  stall box traversal.

The committed pnpm patch rejects ICNS entries shorter than their eight-byte
header and rejects ISO-BMFF boxes shorter than their eight-byte header. The
root `audit:prod` script passes `--ignore` for only those two CVEs because the
version-based audit service cannot detect a local patch. The command keeps the
exclusions visible and effective with the workspace's pinned pnpm 10.13.1; do
not broaden that list.

Remove the local patch and both ignores once Expo/Metro resolves an upstream
`image-size` release that GitHub marks as patched. Until then,
`pnpm install --frozen-lockfile` applies the patch consistently in local and CI
installs.
