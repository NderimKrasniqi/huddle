//! The relay's own envelope between it and a TV.
//!
//! A phone's frames are the Room Protocol itself and pass through untouched.
//! Only the TV side is wrapped, so one TV connection can carry many phones:
//! the relay names each phone connection with an `id` and never reads `data`.

use serde::{Deserialize, Serialize};

/// What a TV sends the relay.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FromHost {
    /// The first frame: claim `code` with a secret only this TV knows.
    Register { code: String, secret: String },
    /// A Room Protocol frame for one phone.
    Frame { id: u64, data: String },
    /// Close one phone's connection.
    Close { id: u64 },
}

/// What the relay sends a TV.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ToHost<'a> {
    Registered {
        code: &'a str,
    },
    Refused {
        reason: &'a str,
    },
    /// A phone connected to this room.
    Open {
        id: u64,
    },
    /// A Room Protocol frame from one phone.
    Frame {
        id: u64,
        data: &'a str,
    },
    /// A phone's connection closed.
    Close {
        id: u64,
    },
}

impl ToHost<'_> {
    pub fn to_json(&self) -> String {
        // Serializing these plain variants cannot fail.
        serde_json::to_string(self).unwrap_or_default()
    }
}
