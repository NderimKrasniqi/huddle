# syntax=docker/dockerfile:1
# The Huddle relay (ADR-03) as one container image:
#   docker build -t huddle-relay relay/
#   docker run -p 8787:8787 huddle-relay
# The `load` stage holds the load binary for TASK-22's check:
#   docker build --target load -t huddle-relay-load relay/
# Base images are pinned by digest; bump the tag and digest together.

FROM rust:1.99.1-slim-trixie@sha256:1a939748a7cbab172de91a014e3804a97af1394a8c844faa67fce9401c4e40fb AS build
WORKDIR /src
# rust-toolchain.toml is left out on purpose: the image's own toolchain builds.
COPY Cargo.toml Cargo.lock ./
COPY huddle-relay huddle-relay
COPY huddle-relay-load huddle-relay-load
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked --workspace \
    && cp target/release/huddle-relay target/release/huddle-relay-load /usr/local/bin/

FROM debian:trixie-slim@sha256:62bd423aeee912639ca8ee681c2b762cb3e25137e0a92b20be455898a9f034ad AS runtime
USER 65532:65532

FROM runtime AS load
COPY --from=build /usr/local/bin/huddle-relay-load /usr/local/bin/huddle-relay-load
ENTRYPOINT ["huddle-relay-load"]

FROM runtime
COPY --from=build /usr/local/bin/huddle-relay /usr/local/bin/huddle-relay
ENV HUDDLE_RELAY_ADDR=0.0.0.0:8787 RUST_LOG=info
EXPOSE 8787
# Liveness: GET /healthz answers "ok".
ENTRYPOINT ["huddle-relay"]
