use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum FromHost {
    Register { code: String, secret: String },
    Frame { id: u64, data: String },
    Close { id: u64 },
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ToHost<'a> {
    Registered { code: &'a str },
    Refused { reason: &'a str },
    Open { id: u64 },
    Frame { id: u64, data: &'a str },
    Close { id: u64 },
}

impl ToHost<'_> {
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}
