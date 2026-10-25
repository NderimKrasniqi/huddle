//! Huddle relay (ADR-03): lets phones reach a TV that cannot accept incoming
//! connections, such as a Samsung or LG web TV.
//!
//! - A TV opens `GET /v1/host` as a WebSocket and registers its room code with
//!   a secret. The same secret reclaims the code after a TV restart.
//! - A phone opens `GET /v1/join/{code}`. Its frames are the Room Protocol and
//!   reach the TV wrapped as `{ "type": "frame", "id", "data" }`; the TV's
//!   replies come back unwrapped. The relay never reads `data`.
//! - The relay keeps no database and no game rules. It enforces frame size,
//!   rooms, phones per room, connections per IP, per-connection rates, and idle
//!   and registration timeouts (see `limits`).
//!
//! `HUDDLE_RELAY_ADDR` sets the listen address (default `0.0.0.0:8787`);
//! `HUDDLE_RELAY_MAX_PER_IP` the connections one IP address may hold (default
//! 64; raise it behind a proxy that hides client addresses, or for a load
//! check from one machine); `RUST_LOG` sets the log filter. Logs carry codes, ids and counts, never frames.

mod limits;
mod rooms;
mod wire;

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::body::Bytes;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio::time::timeout;
use tracing::{info, warn};

use crate::limits::{
    HOST_RATE, IDLE_TIMEOUT, LINGER, MAX_CONNECTIONS_PER_IP, MAX_HOST_FRAME, MAX_PHONE_FRAME,
    OUTBOX, PHONE_RATE, PING_INTERVAL, REGISTER_TIMEOUT, TokenBucket, close,
};
use crate::rooms::{Relay, close_frame};

/// Read buffer per WebSocket. The default (128 KiB) cost 1.5 GB for 11,000
/// mostly idle connections; frames larger than this still arrive, in pieces.
const SOCKET_BUFFER: usize = 4 * 1024;
use crate::wire::{FromHost, ToHost};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let max_per_ip = std::env::var("HUDDLE_RELAY_MAX_PER_IP")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(MAX_CONNECTIONS_PER_IP);
    let relay = Arc::new(Relay::new(max_per_ip));
    spawn_sweeper(relay.clone());

    let app = Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/v1/host", get(host_upgrade))
        .route("/v1/join/{code}", get(join_upgrade))
        .with_state(relay);

    let addr = std::env::var("HUDDLE_RELAY_ADDR").unwrap_or_else(|_| "0.0.0.0:8787".into());
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!(%addr, max_per_ip, "Huddle relay listening");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await
}

/// Returns room codes whose TV never came back, and logs the load now and then.
fn spawn_sweeper(relay: Arc<Relay>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(10));
        loop {
            tick.tick().await;
            let freed = relay.sweep();
            let (rooms, phones) = relay.counts();
            if freed > 0 {
                info!(freed, rooms, phones, "Freed room codes");
            }
        }
    });
}

async fn host_upgrade(
    ws: WebSocketUpgrade,
    State(relay): State<Arc<Relay>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    let ip = peer.ip();
    if !relay.acquire_ip(ip) {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    ws.max_message_size(MAX_HOST_FRAME)
        .read_buffer_size(SOCKET_BUFFER)
        .write_buffer_size(0)
        .on_upgrade(move |socket| async move {
            host_connection(socket, &relay).await;
            relay.release_ip(ip);
        })
}

async fn join_upgrade(
    ws: WebSocketUpgrade,
    Path(code): Path<String>,
    State(relay): State<Arc<Relay>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    let ip: IpAddr = peer.ip();
    if !relay.acquire_ip(ip) {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    let code = code.to_ascii_uppercase();
    ws.max_message_size(MAX_PHONE_FRAME)
        .read_buffer_size(SOCKET_BUFFER)
        .write_buffer_size(0)
        .on_upgrade(move |socket| async move {
            phone_connection(socket, &relay, &code).await;
            relay.release_ip(ip);
        })
}

/// Sends queued messages to one socket and pings it, until the queue closes.
async fn write_loop(mut sink: SplitSink<WebSocket, Message>, mut outbox: mpsc::Receiver<Message>) {
    let mut ping = tokio::time::interval(PING_INTERVAL);
    ping.tick().await;
    loop {
        tokio::select! {
            next = outbox.recv() => {
                let Some(message) = next else { break };
                let closing = matches!(message, Message::Close(_));
                if sink.send(message).await.is_err() || closing {
                    break;
                }
            }
            _ = ping.tick() => {
                if sink.send(Message::Ping(Bytes::new())).await.is_err() {
                    break;
                }
            }
        }
    }
    let _ = sink.close().await;
}

/// Ends a connection: closes the outbox, then reads and discards what the peer
/// still sends until it answers the close (or two seconds pass), so the socket
/// does not reset before the peer reads the close code.
async fn finish(
    mut stream: SplitStream<WebSocket>,
    tx: mpsc::Sender<Message>,
    writer: tokio::task::JoinHandle<()>,
) {
    drop(tx);
    let _ = timeout(LINGER, async {
        while let Some(Ok(_)) = stream.next().await {}
    })
    .await;
    let _ = writer.await;
}

/// The next text frame, or `None` when the connection ends, idles out or
/// sends something the relay does not accept. Pings and pongs count as life.
async fn next_text(stream: &mut SplitStream<WebSocket>, wait: Duration) -> Option<String> {
    loop {
        match timeout(wait, stream.next()).await {
            Ok(Some(Ok(Message::Text(text)))) => return Some(text.as_str().to_owned()),
            Ok(Some(Ok(Message::Ping(_) | Message::Pong(_)))) => continue,
            _ => return None,
        }
    }
}

async fn host_connection(socket: WebSocket, relay: &Relay) {
    let (sink, mut stream) = socket.split();
    let (tx, rx) = mpsc::channel(OUTBOX);
    let writer = tokio::spawn(write_loop(sink, rx));

    let registration = next_text(&mut stream, REGISTER_TIMEOUT).await;
    let Some(Ok(FromHost::Register { code, secret })) =
        registration.map(|text| serde_json::from_str::<FromHost>(&text))
    else {
        let _ = tx
            .send(Message::Text(
                ToHost::Refused {
                    reason: "badRegister",
                }
                .to_json()
                .into(),
            ))
            .await;
        let _ = tx.send(close_frame(1008, "register first")).await;
        finish(stream, tx, writer).await;
        return;
    };
    let generation = match relay.register(&code, &secret, tx.clone()) {
        Ok(generation) => generation,
        Err(reason) => {
            let _ = tx
                .send(Message::Text(ToHost::Refused { reason }.to_json().into()))
                .await;
            let _ = tx.send(close_frame(1008, "refused")).await;
            finish(stream, tx, writer).await;
            return;
        }
    };
    let _ = tx
        .send(Message::Text(
            ToHost::Registered { code: &code }.to_json().into(),
        ))
        .await;
    info!(%code, "TV registered");

    let mut bucket = TokenBucket::new(HOST_RATE);
    while let Some(text) = next_text(&mut stream, IDLE_TIMEOUT).await {
        if !bucket.take() {
            warn!(%code, "TV over its rate limit");
            let _ = tx
                .send(close_frame(close::RATE_LIMITED, "rate limited"))
                .await;
            break;
        }
        match serde_json::from_str::<FromHost>(&text) {
            Ok(FromHost::Frame { id, data }) => {
                // A phone that cannot keep up is closed rather than buffered.
                if let Some(phone) = relay.phone(&code, id)
                    && phone.try_send(Message::Text(data.into())).is_err()
                {
                    relay.remove_phone(&code, id);
                    let _ = phone.try_send(close_frame(close::SLOW_CONSUMER, "too slow"));
                }
            }
            Ok(FromHost::Close { id }) => {
                if let Some(phone) = relay.phone(&code, id) {
                    relay.remove_phone(&code, id);
                    let _ = phone.try_send(close_frame(1000, "closed by tv"));
                }
            }
            Ok(FromHost::Register { .. }) | Err(_) => break,
        }
    }

    relay.host_gone(&code, generation);
    info!(%code, "TV disconnected");
    finish(stream, tx, writer).await;
}

async fn phone_connection(socket: WebSocket, relay: &Relay, code: &str) {
    let (sink, mut stream) = socket.split();
    let (tx, rx) = mpsc::channel(OUTBOX);
    let writer = tokio::spawn(write_loop(sink, rx));

    let (id, host) = match relay.join(code, tx.clone()) {
        Ok(joined) => joined,
        Err(close_code) => {
            let _ = tx.send(close_frame(close_code, "cannot join")).await;
            finish(stream, tx, writer).await;
            return;
        }
    };
    if host
        .try_send(Message::Text(ToHost::Open { id }.to_json().into()))
        .is_err()
    {
        relay.remove_phone(code, id);
        let _ = tx.send(close_frame(close::TV_GONE, "tv busy")).await;
        finish(stream, tx, writer).await;
        return;
    }

    let mut bucket = TokenBucket::new(PHONE_RATE);
    while let Some(text) = next_text(&mut stream, IDLE_TIMEOUT).await {
        if !bucket.take() {
            let _ = tx
                .send(close_frame(close::RATE_LIMITED, "rate limited"))
                .await;
            break;
        }
        let Some(host) = relay.host_of(code, id) else {
            break;
        };
        if host
            .try_send(Message::Text(
                ToHost::Frame { id, data: &text }.to_json().into(),
            ))
            .is_err()
        {
            let _ = tx
                .send(close_frame(close::SLOW_CONSUMER, "tv too slow"))
                .await;
            break;
        }
    }

    if let Some(host) = relay.remove_phone(code, id) {
        let _ = host.try_send(Message::Text(ToHost::Close { id }.to_json().into()));
    }
    finish(stream, tx, writer).await;
}
