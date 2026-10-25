//! Load check for the Huddle relay (TASK-22): simulated TVs and phones.
//!
//! Each room is one TV connection that registers a code and answers every
//! phone frame with a view-sized frame, and `--phones` phone connections that
//! each send `--rate` frames a second. Frames carry the time they were sent,
//! so the binary measures how long the relay takes to forward phone → TV and
//! TV → phone (on this machine's clock, so its own scheduling counts too).
//!
//! ```sh
//! cargo run --release -p huddle-relay-load -- --url ws://127.0.0.1:8787 \
//!   --rooms 1000 --phones 10 --rate 1 --seconds 60 --ramp 20
//! ```
//!
//! The relay must allow this many connections from one address:
//! `HUDDLE_RELAY_MAX_PER_IP=20000`.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::time::{MissedTickBehavior, interval, sleep, timeout};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

/// About the size of a phone command.
const PHONE_PAD: usize = 160;
/// About the size of a view the TV pushes back.
const VIEW_PAD: usize = 1_000;

struct Options {
    url: String,
    rooms: usize,
    phones: usize,
    rate: f64,
    seconds: u64,
    ramp: u64,
}

impl Options {
    fn parse() -> Result<Self, String> {
        let mut options = Self {
            url: "ws://127.0.0.1:8787".into(),
            rooms: 1_000,
            phones: 10,
            rate: 1.0,
            seconds: 60,
            ramp: 20,
        };
        let mut args = std::env::args().skip(1);
        while let Some(flag) = args.next() {
            let value = args.next().ok_or(format!("{flag} needs a value"))?;
            let bad = || format!("{flag}: cannot read {value:?}");
            match flag.as_str() {
                "--url" => options.url = value.trim_end_matches('/').to_owned(),
                "--rooms" => options.rooms = value.parse().map_err(|_| bad())?,
                "--phones" => options.phones = value.parse().map_err(|_| bad())?,
                "--rate" => options.rate = value.parse().map_err(|_| bad())?,
                "--seconds" => options.seconds = value.parse().map_err(|_| bad())?,
                "--ramp" => options.ramp = value.parse().map_err(|_| bad())?,
                _ => return Err(format!("unknown flag {flag}")),
            }
        }
        if options.rooms == 0 || options.rooms > 26usize.pow(4) {
            return Err("--rooms must be between 1 and 456976".into());
        }
        Ok(options)
    }
}

#[derive(Default)]
struct Counters {
    tvs_registered: AtomicU64,
    phones_open: AtomicU64,
    frames_sent: AtomicU64,
    frames_back: AtomicU64,
    failures: AtomicU64,
}

/// What the TV gets from the relay.
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum FromRelay {
    Registered,
    Refused { reason: String },
    Open,
    Frame { id: u64, data: String },
    Close,
}

#[derive(Deserialize)]
struct Stamp {
    t: u64,
}

fn code_for(index: usize) -> String {
    let mut code = String::with_capacity(4);
    let mut rest = index;
    for _ in 0..4 {
        code.insert(0, char::from(b'A' + (rest % 26) as u8));
        rest /= 26;
    }
    code
}

fn micros(start: Instant) -> u64 {
    start.elapsed().as_micros() as u64
}

fn stamped(start: Instant, pad: usize) -> String {
    format!(r#"{{"t":{},"pad":"{}"}}"#, micros(start), "x".repeat(pad))
}

/// One TV: registers its code, then answers every phone frame. Returns the
/// phone → TV forward times in microseconds.
async fn run_tv(
    url: String,
    code: String,
    start: Instant,
    until: Instant,
    counters: Arc<Counters>,
    registered: tokio::sync::oneshot::Sender<()>,
) -> Vec<u32> {
    let mut times = Vec::new();
    let Ok((mut socket, _)) = connect_async(format!("{url}/v1/host")).await else {
        counters.failures.fetch_add(1, Ordering::Relaxed);
        return times;
    };
    // A fixed secret per code, so a rerun within the relay's grace window reclaims it.
    let register =
        format!(r#"{{"type":"register","code":"{code}","secret":"huddle-load-{code}-secret"}}"#);
    if socket.send(Message::text(register)).await.is_err() {
        counters.failures.fetch_add(1, Ordering::Relaxed);
        return times;
    }
    let mut registered = Some(registered);
    loop {
        let left = until.saturating_duration_since(Instant::now()) + Duration::from_secs(5);
        let Ok(Some(Ok(message))) = timeout(left, socket.next()).await else {
            break;
        };
        let Message::Text(text) = message else {
            continue;
        };
        match serde_json::from_str::<FromRelay>(text.as_str()) {
            Ok(FromRelay::Registered) => {
                counters.tvs_registered.fetch_add(1, Ordering::Relaxed);
                if let Some(ready) = registered.take() {
                    let _ = ready.send(());
                }
            }
            Ok(FromRelay::Refused { reason }) => {
                eprintln!("TV {code} refused: {reason}");
                counters.failures.fetch_add(1, Ordering::Relaxed);
                break;
            }
            Ok(FromRelay::Frame { id, data }) => {
                if let Ok(stamp) = serde_json::from_str::<Stamp>(&data) {
                    times.push(micros(start).saturating_sub(stamp.t) as u32);
                }
                let reply = serde_json::json!({ "type": "frame", "id": id, "data": stamped(start, VIEW_PAD) });
                if socket.send(Message::text(reply.to_string())).await.is_err() {
                    break;
                }
            }
            Ok(FromRelay::Open | FromRelay::Close) | Err(_) => {}
        }
        if Instant::now() > until + Duration::from_secs(3) {
            break;
        }
    }
    let _ = socket.close(None).await;
    times
}

/// One phone: sends `rate` frames a second until `until`. Returns the TV →
/// phone forward times in microseconds.
async fn run_phone(
    url: String,
    code: String,
    rate: f64,
    start: Instant,
    until: Instant,
    counters: Arc<Counters>,
) -> Vec<u32> {
    let mut times = Vec::new();
    let Ok((socket, _)) = connect_async(format!("{url}/v1/join/{code}")).await else {
        counters.failures.fetch_add(1, Ordering::Relaxed);
        return times;
    };
    counters.phones_open.fetch_add(1, Ordering::Relaxed);
    let (mut sink, mut stream) = socket.split();
    let mut tick = interval(Duration::from_secs_f64(1.0 / rate));
    tick.set_missed_tick_behavior(MissedTickBehavior::Delay);
    let mut closed_early = false;
    loop {
        tokio::select! {
            _ = tick.tick() => {
                if Instant::now() >= until { break; }
                if sink.send(Message::text(stamped(start, PHONE_PAD))).await.is_err() {
                    closed_early = true;
                    break;
                }
                counters.frames_sent.fetch_add(1, Ordering::Relaxed);
            }
            next = stream.next() => match next {
                Some(Ok(Message::Text(text))) => {
                    if let Ok(stamp) = serde_json::from_str::<Stamp>(text.as_str()) {
                        times.push(micros(start).saturating_sub(stamp.t) as u32);
                        counters.frames_back.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Some(Ok(_)) => {}
                _ => { closed_early = true; break; }
            }
        }
    }
    if closed_early {
        counters.failures.fetch_add(1, Ordering::Relaxed);
    }
    // Collect the replies still in flight, then leave.
    let _ = timeout(Duration::from_secs(1), async {
        while let Some(Ok(Message::Text(text))) = stream.next().await {
            if let Ok(stamp) = serde_json::from_str::<Stamp>(text.as_str()) {
                times.push(micros(start).saturating_sub(stamp.t) as u32);
                counters.frames_back.fetch_add(1, Ordering::Relaxed);
            }
        }
    })
    .await;
    let _ = sink.close().await;
    times
}

fn report(name: &str, mut times: Vec<u32>) {
    if times.is_empty() {
        println!("{name}: no samples");
        return;
    }
    times.sort_unstable();
    let at = |q: f64| f64::from(times[((times.len() - 1) as f64 * q) as usize]) / 1_000.0;
    println!(
        "{name}: {} samples, p50 {:.2} ms, p95 {:.2} ms, p99 {:.2} ms, max {:.2} ms",
        times.len(),
        at(0.50),
        at(0.95),
        at(0.99),
        at(1.0),
    );
}

#[tokio::main]
async fn main() {
    let options = match Options::parse() {
        Ok(options) => options,
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(2);
        }
    };
    let start = Instant::now();
    let until = start + Duration::from_secs(options.ramp + options.seconds);
    let counters = Arc::new(Counters::default());
    let spacing = Duration::from_secs_f64(options.ramp as f64 / options.rooms as f64);
    println!(
        "{} rooms × {} phones at {} frames/s each, {} s ramp + {} s against {}",
        options.rooms, options.phones, options.rate, options.ramp, options.seconds, options.url
    );

    let mut tvs = Vec::with_capacity(options.rooms);
    let mut phones = Vec::with_capacity(options.rooms * options.phones);
    for index in 0..options.rooms {
        let code = code_for(index);
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        tvs.push(tokio::spawn(run_tv(
            options.url.clone(),
            code.clone(),
            start,
            until,
            counters.clone(),
            ready_tx,
        )));
        // Phones join once their TV holds the code.
        if timeout(Duration::from_secs(10), ready_rx).await.is_ok() {
            for _ in 0..options.phones {
                phones.push(tokio::spawn(run_phone(
                    options.url.clone(),
                    code.clone(),
                    options.rate,
                    start,
                    until,
                    counters.clone(),
                )));
            }
        }
        sleep(spacing).await;
    }

    let status = {
        let counters = counters.clone();
        tokio::spawn(async move {
            let mut tick = interval(Duration::from_secs(10));
            loop {
                tick.tick().await;
                println!(
                    "{:>4} s: {} TVs, {} phones, {} sent, {} back, {} failures",
                    start.elapsed().as_secs(),
                    counters.tvs_registered.load(Ordering::Relaxed),
                    counters.phones_open.load(Ordering::Relaxed),
                    counters.frames_sent.load(Ordering::Relaxed),
                    counters.frames_back.load(Ordering::Relaxed),
                    counters.failures.load(Ordering::Relaxed),
                );
            }
        })
    };

    let mut to_phone = Vec::new();
    for phone in phones {
        to_phone.extend(phone.await.unwrap_or_default());
    }
    let mut to_tv = Vec::new();
    for tv in tvs {
        to_tv.extend(tv.await.unwrap_or_default());
    }
    status.abort();

    println!(
        "TVs registered {}, phones opened {}, frames sent {}, frames back {}, failures {}",
        counters.tvs_registered.load(Ordering::Relaxed),
        counters.phones_open.load(Ordering::Relaxed),
        counters.frames_sent.load(Ordering::Relaxed),
        counters.frames_back.load(Ordering::Relaxed),
        counters.failures.load(Ordering::Relaxed),
    );
    report("phone → TV", to_tv);
    report("TV → phone", to_phone);
}
