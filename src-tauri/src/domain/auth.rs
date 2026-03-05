// src-tauri/src/domain/auth.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: Option<String>, 
}

#[derive(Deserialize, Debug)]
pub struct MicrosoftTokenResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>, 
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MinecraftAccount {
    pub uuid: String,
    pub name: String,
    pub r#type: String, 
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub skin_url: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct Skin {
    pub url: String,
}

#[derive(Deserialize, Debug)]
pub struct McProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<Skin>,
}