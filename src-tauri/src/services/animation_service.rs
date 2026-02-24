// src-tauri/src/services/animation_service.rs
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime}; // 引入 Runtime
use crate::error::{AppError, AppResult};
use crate::domain::animation::AnimationRequest;

pub struct AnimationService;

impl AnimationService {
    // 【关键修复】：加上 <R: Runtime>，并将 AppHandle 改为 AppHandle<R>
    pub fn resolve_and_load<R: Runtime>(
        app: &AppHandle<R>, 
        req: AnimationRequest
    ) -> AppResult<Option<String>> {
        
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|_| AppError::PathResolution)?;

        let user_anim_path = app_data_dir
            .join("piconfig")
            .join("animations")
            .join(&req.animation_name);

        let instance_root = Path::new(&req.instance_path);
        let modpack_anim_path = instance_root
            .join("piconfig")
            .join("animations")
            .join(&req.animation_name);

        let is_user_first = req.is_premium && req.user_prioritized;
        
        let check_order = if is_user_first {
            vec![user_anim_path, modpack_anim_path]
        } else {
            vec![modpack_anim_path, user_anim_path]
        };

        for path in check_order {
            if path.exists() && path.is_file() {
                let content = std::fs::read_to_string(&path)?;
                return Ok(Some(content));
            }
        }

        Ok(None)
    }
}