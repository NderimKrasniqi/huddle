//! The relay's shared state: which TV holds which room code, and which phone
//! connections belong to it. It holds no game state and no Room Protocol data.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use axum::extract::ws::{CloseFrame, Message};
use tokio::sync::mpsc::Sender;

use crate::limits::{
    CODE_LENGTH, HOST_GRACE, MAX_PHONES_PER_ROOM, MAX_ROOMS, SECRET_LENGTH, close,
};

struct Host {
    generation: u64,
    tx: Sender<Message>,
}

struct Room {
    secret: String,
    host: Option<Host>,
    phones: HashMap<u64, Sender<Message>>,
    /// While the TV is away: when the code goes back to the pool.
    reserved_until: Option<Instant>,
}

#[derive(Default)]
struct Inner {
    rooms: HashMap<String, Room>,
    per_ip: HashMap<IpAddr, u32>,
}

pub struct Relay {
    inner: Mutex<Inner>,
    next_id: AtomicU64,
    max_per_ip: u32,
}

/// A close frame with a relay close code.
pub fn close_frame(code: u16, reason: &'static str) -> Message {
    Message::Close(Some(CloseFrame {
        code,
        reason: reason.into(),
    }))
}

fn valid_code(code: &str) -> bool {
    code.len() == CODE_LENGTH && code.bytes().all(|b| b.is_ascii_uppercase())
}

impl Relay {
    /// A relay that lets each IP address hold `max_per_ip` connections.
    pub fn new(max_per_ip: u32) -> Self {
        Self {
            inner: Mutex::default(),
            next_id: AtomicU64::default(),
            max_per_ip,
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        // A panic while holding the lock leaves plain maps behind; keep serving.
        self.inner
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn next(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed) + 1
    }

    pub fn acquire_ip(&self, ip: IpAddr) -> bool {
        let mut inner = self.lock();
        let count = inner.per_ip.entry(ip).or_insert(0);
        if *count >= self.max_per_ip {
            return false;
        }
        *count += 1;
        true
    }

    pub fn release_ip(&self, ip: IpAddr) {
        let mut inner = self.lock();
        if let Some(count) = inner.per_ip.get_mut(&ip) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                inner.per_ip.remove(&ip);
            }
        }
    }

    /// Claims `code` for a TV. The same secret reclaims it after a restart;
    /// any other secret is refused while the room or its reservation lasts.
    pub fn register(
        &self,
        code: &str,
        secret: &str,
        tx: Sender<Message>,
    ) -> Result<u64, &'static str> {
        if !valid_code(code) || !SECRET_LENGTH.contains(&secret.len()) {
            return Err("badRegister");
        }
        let generation = self.next();
        let mut inner = self.lock();
        let room_count = inner.rooms.len();
        match inner.rooms.get_mut(code) {
            Some(room) if room.secret != secret => Err("codeTaken"),
            Some(room) => {
                // The same TV again: phones on an older connection start over.
                if let Some(old) = room.host.take() {
                    let _ = old.tx.try_send(close_frame(close::TV_GONE, "replaced"));
                }
                for (_, phone) in room.phones.drain() {
                    let _ = phone.try_send(close_frame(close::TV_GONE, "tv reconnected"));
                }
                room.host = Some(Host { generation, tx });
                room.reserved_until = None;
                Ok(generation)
            }
            None if room_count >= MAX_ROOMS => Err("full"),
            None => {
                inner.rooms.insert(
                    code.to_owned(),
                    Room {
                        secret: secret.to_owned(),
                        host: Some(Host { generation, tx }),
                        phones: HashMap::new(),
                        reserved_until: None,
                    },
                );
                Ok(generation)
            }
        }
    }

    /// The TV's connection ended: its phones are closed and the code stays
    /// reserved for it for `HOST_GRACE`.
    pub fn host_gone(&self, code: &str, generation: u64) {
        let mut inner = self.lock();
        let Some(room) = inner.rooms.get_mut(code) else {
            return;
        };
        if room.host.as_ref().map(|host| host.generation) != Some(generation) {
            return;
        }
        room.host = None;
        room.reserved_until = Some(Instant::now() + HOST_GRACE);
        for (_, phone) in room.phones.drain() {
            let _ = phone.try_send(close_frame(close::TV_GONE, "tv gone"));
        }
    }

    /// Adds a phone to a room whose TV is connected; returns its id and the TV.
    pub fn join(&self, code: &str, tx: Sender<Message>) -> Result<(u64, Sender<Message>), u16> {
        let id = self.next();
        let mut inner = self.lock();
        let Some(room) = inner.rooms.get_mut(code) else {
            return Err(close::NO_ROOM);
        };
        let Some(host) = room.host.as_ref() else {
            return Err(close::NO_ROOM);
        };
        if room.phones.len() >= MAX_PHONES_PER_ROOM {
            return Err(close::ROOM_FULL);
        }
        let host_tx = host.tx.clone();
        room.phones.insert(id, tx);
        Ok((id, host_tx))
    }

    /// The TV this phone's room belongs to, while both are connected.
    pub fn host_of(&self, code: &str, id: u64) -> Option<Sender<Message>> {
        let inner = self.lock();
        let room = inner.rooms.get(code)?;
        room.phones
            .contains_key(&id)
            .then(|| room.host.as_ref().map(|host| host.tx.clone()))
            .flatten()
    }

    pub fn phone(&self, code: &str, id: u64) -> Option<Sender<Message>> {
        self.lock().rooms.get(code)?.phones.get(&id).cloned()
    }

    /// Removes a phone; returns the TV to tell, if it is still connected.
    pub fn remove_phone(&self, code: &str, id: u64) -> Option<Sender<Message>> {
        let mut inner = self.lock();
        let room = inner.rooms.get_mut(code)?;
        room.phones.remove(&id)?;
        room.host.as_ref().map(|host| host.tx.clone())
    }

    /// Returns reserved codes whose TV never came back to the pool.
    pub fn sweep(&self) -> usize {
        let now = Instant::now();
        let mut inner = self.lock();
        let before = inner.rooms.len();
        inner.rooms.retain(|_, room| {
            room.host.is_some() || room.reserved_until.is_some_and(|until| until > now)
        });
        before - inner.rooms.len()
    }

    pub fn counts(&self) -> (usize, usize) {
        let inner = self.lock();
        (
            inner.rooms.len(),
            inner.rooms.values().map(|room| room.phones.len()).sum(),
        )
    }
}
