use tauri::{AppHandle, Emitter, Runtime};

use crate::domain::event::DownloadProgressEvent;

/// 进度上报阶段类型
#[derive(Clone, Copy)]
pub enum DownloadStage {
    Libraries,
    Assets,
}

impl DownloadStage {
    pub fn stage_name(self) -> &'static str {
        match self {
            DownloadStage::Libraries => "LIBRARIES",
            DownloadStage::Assets => "ASSETS",
        }
    }

    fn message_prefix(self) -> &'static str {
        match self {
            DownloadStage::Libraries => "正在下载依赖库",
            DownloadStage::Assets => "正在下载游戏资源",
        }
    }

    /// 不同阶段使用不同的上报步长
    pub fn step(self) -> u64 {
        match self {
            DownloadStage::Libraries => 10,
            DownloadStage::Assets => 50,
        }
    }
}

/// 统一的下载进度上报
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
            message: format!(
                "{} ({}/{})",
                stage.message_prefix(),
                current,
                total
            ),
        },
    );
}

