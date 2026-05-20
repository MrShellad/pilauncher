// src-tauri/src/services/launcher/builder.rs
use crate::domain::launcher::{AuthSession, ResolvedLaunchConfig};
use serde_json::Value;
use std::fmt;
use std::path::PathBuf;

mod args;
mod natives;
mod rules;
mod version_chain;

struct VersionManifest {
    id: String,
    json: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LaunchPreparationError {
    MissingDependencies(Vec<String>),
    BuildFailed(String),
}

impl LaunchPreparationError {
    pub fn user_message(&self) -> &str {
        match self {
            Self::MissingDependencies(_) => "库文件不完整，请重新下载",
            Self::BuildFailed(message) => message.as_str(),
        }
    }

    pub fn diagnostic_lines(&self) -> Vec<String> {
        match self {
            Self::MissingDependencies(details) => {
                let mut lines = vec!["[Launcher ERROR] 库文件不完整，请重新下载".to_string()];
                lines.extend(
                    details
                        .iter()
                        .map(|detail| format!("[Launcher ERROR] {}", detail)),
                );
                lines
            }
            Self::BuildFailed(message) => vec![format!("[Launcher ERROR] {}", message)],
        }
    }
}

impl fmt::Display for LaunchPreparationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for LaunchPreparationError {}

pub struct LaunchCommandBuilder {
    config: ResolvedLaunchConfig,
    auth: AuthSession,
    game_dir: PathBuf,
    runtime_dir: PathBuf,
    mc_version: String,
    target_version_id: String,
    third_party_root: Option<PathBuf>,
}

impl LaunchCommandBuilder {
    pub fn new(
        config: ResolvedLaunchConfig,
        auth: AuthSession,
        mc_version: &str,
        target_version_id: &str,
        game_dir: PathBuf,
        runtime_dir: PathBuf,
        third_party_root: Option<PathBuf>,
    ) -> Self {
        Self {
            config,
            auth,
            mc_version: mc_version.to_string(),
            target_version_id: target_version_id.to_string(),
            game_dir,
            runtime_dir,
            third_party_root,
        }
    }

    pub fn natives_dir(&self) -> PathBuf {
        self.get_natives_dir()
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.get_assets_dir()
    }

    pub fn libraries_dir(&self) -> PathBuf {
        self.get_libraries_dir()
    }
}
