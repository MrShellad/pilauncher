use tauri::{AppHandle, Emitter, Runtime};

use crate::domain::event::DownloadProgressEvent;

#[derive(Clone, Copy)]
pub enum DownloadStage {
    Libraries,
    Assets,
    Mods,
}

impl DownloadStage {
    pub fn stage_name(self) -> &'static str {
        match self {
            DownloadStage::Libraries => "LIBRARIES",
            DownloadStage::Assets => "ASSETS",
            DownloadStage::Mods => "DOWNLOADING_MOD",
        }
    }

    fn message_prefix(self) -> &'static str {
        match self {
            DownloadStage::Libraries => "Downloading libraries",
            DownloadStage::Assets => "Downloading assets",
            DownloadStage::Mods => "Downloading mods",
        }
    }

    pub fn step(self) -> u64 {
        match self {
            DownloadStage::Libraries => 10,
            DownloadStage::Assets => 50,
            DownloadStage::Mods => 1,
        }
    }
}

pub fn emit_download_progress<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    stage: DownloadStage,
    file_name: String,
    current: u64,
    total: u64,
) {
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: stage.stage_name().to_string(),
            file_name,
            current,
            total,
            message: format!("{} ({}/{})", stage.message_prefix(), current, total),
        },
    );
}

pub fn emit_download_speed<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    stage: DownloadStage,
    file_name: String,
    current: u64,
    total: u64,
) {
    let _ = app.emit(
        "instance-deployment-speed",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: stage.stage_name().to_string(),
            file_name,
            current,
            total,
            message: String::new(),
        },
    );
}
