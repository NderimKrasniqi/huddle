use std::time::{Duration, Instant};

pub const MAX_PHONE_FRAME: usize = 256 * 1024;
pub const MAX_HOST_FRAME: usize = 1024 * 1024;
pub const MAX_ROOMS: usize = 10_000;
pub const MAX_PHONES_PER_ROOM: usize = 32;
pub const MAX_CONNECTIONS_PER_IP: u32 = 64;
pub const REGISTER_TIMEOUT: Duration = Duration::from_secs(10);
pub const PING_INTERVAL: Duration = Duration::from_secs(15);
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(45);
pub const LINGER: Duration = Duration::from_secs(2);
pub const HOST_GRACE: Duration = Duration::from_secs(600);
pub const OUTBOX: usize = 256;
pub const CODE_LENGTH: usize = 4;
pub const SECRET_LENGTH: std::ops::RangeInclusive<usize> = 16..=128;

pub const PHONE_RATE: (f64, f64) = (60.0, 120.0);
pub const HOST_RATE: (f64, f64) = (600.0, 1_200.0);

pub mod close {
    pub const NO_ROOM: u16 = 4404;
    pub const ROOM_FULL: u16 = 4429;
    pub const TV_GONE: u16 = 4410;
    pub const RATE_LIMITED: u16 = 4408;
    pub const SLOW_CONSUMER: u16 = 4409;
}

pub struct TokenBucket {
    tokens: f64,
    at: Instant,
    rate: f64,
    capacity: f64,
}

impl TokenBucket {
    pub fn new((rate, capacity): (f64, f64)) -> Self {
        Self {
            tokens: capacity,
            at: Instant::now(),
            rate,
            capacity,
        }
    }

    pub fn take(&mut self) -> bool {
        let now = Instant::now();
        let refill = now.duration_since(self.at).as_secs_f64() * self.rate;
        self.tokens = (self.tokens + refill).min(self.capacity);
        self.at = now;
        if self.tokens < 1.0 {
            return false;
        }
        self.tokens -= 1.0;
        true
    }
}
