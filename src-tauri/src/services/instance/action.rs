// src-tauri/src/services/instance/action.rs
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};
use crate::services::config_service::ConfigService;
use serde_json::Value;

pub struct InstanceActionService;

impl InstanceActionService {
    fn get_instance_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        Ok(PathBuf::from(base_path).join("instances").join(id))
    }

    // ✅ 新增：读取实例详情（供前端获取真实 Name 和 Cover）
    pub fn get_detail<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<Value, String> {
        let instance_dir = Self::get_instance_dir(app, id)?;
        let json_path = instance_dir.join("instance.json");
        
        if json_path.exists() {
            let data = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
            let mut json: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
            
            // 如果存在封面图，拼接出它的绝对路径供前端转换
            if let Some(cover) = json["cover_image"].as_str() {
                let abs_path = instance_dir.join(cover).to_string_lossy().to_string();
                json["cover_absolute_path"] = Value::String(abs_path);
            }
            json["id"] = Value::String(id.to_string());
            
            Ok(json)
        } else {
            Err(format!("实例 {} 的配置文件不存在", id))
        }
    }

    pub fn rename<R: Runtime>(app: &AppHandle<R>, id: &str, new_name: &str) -> Result<(), String> {
        let instance_dir = Self::get_instance_dir(app, id)?;
        let json_path = instance_dir.join("instance.json");
        if json_path.exists() {
            let data = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
            let mut json: Value = serde_json::from_str(&data).unwrap_or(serde_json::json!({}));
            json["name"] = Value::String(new_name.to_string());
            fs::write(&json_path, serde_json::to_string_pretty(&json).unwrap()).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // ✅ 修改：保存封面图到 piconfig 文件夹
    pub fn change_cover<R: Runtime>(app: &AppHandle<R>, id: &str, image_path: &str) -> Result<String, String> {
        let instance_dir = Self::get_instance_dir(app, id)?;
        
        // 确保 piconfig 目录存在
        let piconfig_dir = instance_dir.join("piconfig");
        if !piconfig_dir.exists() {
            fs::create_dir_all(&piconfig_dir).map_err(|e| e.to_string())?;
        }
        
        let source = std::path::Path::new(image_path);
        if !source.exists() { return Err("选中的图片不存在".to_string()); }
        
        let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let target_name = format!("cover.{}", ext);
        let target_path = piconfig_dir.join(&target_name); // 存入 piconfig
        
        fs::copy(source, &target_path).map_err(|e| e.to_string())?;
        
        let json_path = instance_dir.join("instance.json");
        if json_path.exists() {
            let data = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
            let mut json: Value = serde_json::from_str(&data).unwrap_or(serde_json::json!({}));
            // 写入相对路径 piconfig/cover.xxx
            json["cover_image"] = Value::String(format!("piconfig/{}", target_name));
            fs::write(&json_path, serde_json::to_string_pretty(&json).unwrap()).map_err(|e| e.to_string())?;
        }
        Ok(target_path.to_string_lossy().to_string())
    }

    pub fn delete<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<(), String> {
        let instance_dir = Self::get_instance_dir(app, id)?;
        if instance_dir.exists() {
            fs::remove_dir_all(instance_dir).map_err(|e| format!("删除失败: {}", e))?;
        }
        Ok(())
    }
}