// src-tauri/src/commands/instance/keymap_cmd.rs
use crate::services::instance::binding::InstanceBindingService;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct KeyBind {
    pub name: String,
    pub key: String,
}

#[tauri::command]
pub async fn get_instance_keybindings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<Vec<KeyBind>, String> {
    let config_path = InstanceBindingService::instance_config_path(&app, &instance_id)?;
    let instance_dir = config_path.parent().ok_or_else(|| "无法获取实例目录".to_string())?;

    let config = InstanceBindingService::load_instance_config(&app, &instance_id)?;
    let mut game_dir = instance_dir.to_path_buf();
    if let Some(tp_path) = &config.third_party_path {
        if !tp_path.is_empty() {
            let tp_buf = PathBuf::from(tp_path);
            if tp_buf.exists() {
                game_dir = tp_buf;
            }
        }
    }

    let options_path = game_dir.join("options.txt");
    if !options_path.exists() {
        return Err("OPTIONS_TXT_NOT_FOUND".to_string());
    }

    let content = fs::read_to_string(&options_path).map_err(|e| format!("读取 options.txt 失败: {}", e))?;
    let mut keybindings = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("key_") {
            if let Some(pos) = line.find(':') {
                let name = line[4..pos].to_string();
                let key = line[pos + 1..].to_string();
                keybindings.push(KeyBind { name, key });
            }
        }
    }

    Ok(keybindings)
}

#[tauri::command]
pub async fn save_instance_keybindings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    keybindings: Vec<KeyBind>,
) -> Result<(), String> {
    let config_path = InstanceBindingService::instance_config_path(&app, &instance_id)?;
    let instance_dir = config_path.parent().ok_or_else(|| "无法获取实例目录".to_string())?;

    let config = InstanceBindingService::load_instance_config(&app, &instance_id)?;
    let mut game_dir = instance_dir.to_path_buf();
    if let Some(tp_path) = &config.third_party_path {
        if !tp_path.is_empty() {
            let tp_buf = PathBuf::from(tp_path);
            if tp_buf.exists() {
                game_dir = tp_buf;
            }
        }
    }

    let options_path = game_dir.join("options.txt");

    let mut lines = Vec::new();
    if options_path.exists() {
        if let Ok(content) = fs::read_to_string(&options_path) {
            lines = content.lines().map(|s| s.to_string()).collect();
        }
    }

    for kb in keybindings {
        let target_prefix = format!("key_{}:", kb.name);
        let target_line = format!("key_{}:{}", kb.name, kb.key);
        let mut found = false;
        for line in &mut lines {
            if line.starts_with(&target_prefix) {
                *line = target_line.clone();
                found = true;
                break;
            }
        }
        if !found {
            lines.push(target_line);
        }
    }

    let new_content = lines.join("\n") + "\n";
    fs::write(&options_path, new_content).map_err(|e| format!("保存 options.txt 失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn initialize_default_keybindings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<(), String> {
    let config_path = InstanceBindingService::instance_config_path(&app, &instance_id)?;
    let instance_dir = config_path.parent().ok_or_else(|| "无法获取实例目录".to_string())?;

    let config = InstanceBindingService::load_instance_config(&app, &instance_id)?;
    let mut game_dir = instance_dir.to_path_buf();
    if let Some(tp_path) = &config.third_party_path {
        if !tp_path.is_empty() {
            let tp_buf = PathBuf::from(tp_path);
            if tp_buf.exists() {
                game_dir = tp_buf;
            }
        }
    }

    if !game_dir.exists() {
        fs::create_dir_all(&game_dir).map_err(|e| format!("创建游戏目录失败: {}", e))?;
    }

    let options_path = game_dir.join("options.txt");

    let defaults = vec![
        "key_key.forward:key.keyboard.w",
        "key_key.left:key.keyboard.a",
        "key_key.back:key.keyboard.s",
        "key_key.right:key.keyboard.d",
        "key_key.jump:key.keyboard.space",
        "key_key.sneak:key.keyboard.left.shift",
        "key_key.sprint:key.keyboard.left.control",
        "key_key.drop:key.keyboard.q",
        "key_key.inventory:key.keyboard.e",
        "key_key.chat:key.keyboard.t",
        "key_key.playerlist:key.keyboard.tab",
        "key_key.screenshot:key.keyboard.f2",
        "key_key.togglePerspective:key.keyboard.f5",
        "key_key.swapHands:key.keyboard.f",
        "key_key.use:key.mouse.right",
        "key_key.attack:key.mouse.left",
        "key_key.pickItem:key.mouse.middle",
        "key_key.fullscreen:key.keyboard.f11",
    ];

    let content = defaults.join("\n") + "\n";
    fs::write(&options_path, content).map_err(|e| format!("初始化 options.txt 失败: {}", e))?;

    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardLocalizationMetadata {
    pub authors: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub version: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardLocalization {
    pub metadata: KeyboardLocalizationMetadata,
    pub keys: std::collections::HashMap<String, String>,
    pub actions: std::collections::HashMap<String, String>,
}

#[tauri::command]
pub async fn get_keyboard_localization<R: Runtime>(
    app: AppHandle<R>,
    lang: String,
) -> Result<KeyboardLocalization, String> {
    let base_path_str = match crate::services::config_service::ConfigService::get_base_path(&app) {
        Ok(Some(p)) => p,
        _ => return Err("未配置基础目录".to_string()),
    };

    let i18n_dir = PathBuf::from(base_path_str)
        .join("config")
        .join("keyboard")
        .join("i18");

    if !i18n_dir.exists() {
        fs::create_dir_all(&i18n_dir).map_err(|e| format!("创建 i18 目录失败: {}", e))?;
    }

    let file_path = i18n_dir.join(format!("{}.json", lang));

    if !file_path.exists() {
        if lang == "zh-CN" {
            // Generate default zh-CN
            let default_loc = get_default_zh_cn_localization();
            let json_str = serde_json::to_string_pretty(&default_loc)
                .map_err(|e| format!("序列化默认翻译失败: {}", e))?;
            fs::write(&file_path, json_str).map_err(|e| format!("写入默认翻译文件失败: {}", e))?;
            return Ok(default_loc);
        } else {
            // Check if zh-CN exists or try to generate it, then fall back to it
            let zh_cn_path = i18n_dir.join("zh-CN.json");
            if !zh_cn_path.exists() {
                let default_loc = get_default_zh_cn_localization();
                if let Ok(json_str) = serde_json::to_string_pretty(&default_loc) {
                    let _ = fs::write(&zh_cn_path, json_str);
                }
            }
            // Read zh-CN as fallback
            let content = fs::read_to_string(&zh_cn_path)
                .map_err(|e| format!("读取默认翻译文件失败: {}", e))?;
            let loc: KeyboardLocalization = serde_json::from_str(&content)
                .map_err(|e| format!("解析默认翻译文件失败: {}", e))?;
            return Ok(loc);
        }
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("读取翻译文件失败: {}", e))?;
    let loc: KeyboardLocalization = serde_json::from_str(&content)
        .map_err(|e| format!("解析翻译文件失败: {}", e))?;

    Ok(loc)
}

fn get_default_zh_cn_localization() -> KeyboardLocalization {
    let mut keys = std::collections::HashMap::new();
    keys.insert("key.mouse.left".to_string(), "鼠标左键".to_string());
    keys.insert("key.mouse.right".to_string(), "鼠标右键".to_string());
    keys.insert("key.mouse.middle".to_string(), "鼠标中键".to_string());
    keys.insert("key.keyboard.space".to_string(), "空格键".to_string());
    keys.insert("key.keyboard.left.shift".to_string(), "左 Shift".to_string());
    keys.insert("key.keyboard.right.shift".to_string(), "右 Shift".to_string());
    keys.insert("key.keyboard.left.control".to_string(), "左 Ctrl".to_string());
    keys.insert("key.keyboard.right.control".to_string(), "右 Ctrl".to_string());
    keys.insert("key.keyboard.left.alt".to_string(), "左 Alt".to_string());
    keys.insert("key.keyboard.right.alt".to_string(), "右 Alt".to_string());
    keys.insert("key.keyboard.escape".to_string(), "Esc".to_string());
    keys.insert("key.keyboard.enter".to_string(), "回车键".to_string());
    keys.insert("key.keyboard.tab".to_string(), "Tab 键".to_string());
    keys.insert("key.keyboard.backspace".to_string(), "退格键".to_string());
    keys.insert("key.keyboard.caps.lock".to_string(), "大写锁定".to_string());
    keys.insert("key.keyboard.num.lock".to_string(), "数字锁定".to_string());
    keys.insert("key.keyboard.scroll.lock".to_string(), "滚动锁定".to_string());
    keys.insert("key.keyboard.up".to_string(), "方向键上".to_string());
    keys.insert("key.keyboard.down".to_string(), "方向键下".to_string());
    keys.insert("key.keyboard.left".to_string(), "方向键左".to_string());
    keys.insert("key.keyboard.right".to_string(), "方向键右".to_string());

    let mut actions = std::collections::HashMap::new();
    actions.insert("key.forward".to_string(), "向前移动".to_string());
    actions.insert("key.left".to_string(), "向左移动".to_string());
    actions.insert("key.back".to_string(), "向后移动".to_string());
    actions.insert("key.right".to_string(), "向右移动".to_string());
    actions.insert("key.jump".to_string(), "跳跃".to_string());
    actions.insert("key.sneak".to_string(), "潜行".to_string());
    actions.insert("key.sprint".to_string(), "疾跑".to_string());
    actions.insert("key.drop".to_string(), "丢弃物品".to_string());
    actions.insert("key.inventory".to_string(), "打开/关闭背包".to_string());
    actions.insert("key.chat".to_string(), "打开聊天栏".to_string());
    actions.insert("key.playerlist".to_string(), "显示玩家列表".to_string());
    actions.insert("key.screenshot".to_string(), "截图".to_string());
    actions.insert("key.togglePerspective".to_string(), "切换视角".to_string());
    actions.insert("key.smoothCamera".to_string(), "电影级摄像机".to_string());
    actions.insert("key.swapHands".to_string(), "副手物品交换".to_string());
    actions.insert("key.use".to_string(), "使用物品/放置方块".to_string());
    actions.insert("key.attack".to_string(), "攻击/毁坏".to_string());
    actions.insert("key.pickItem".to_string(), "选取方块".to_string());
    actions.insert("key.fullscreen".to_string(), "切换全屏".to_string());
    actions.insert("key.spectatorOutlines".to_string(), "高亮显示玩家 (旁观)".to_string());
    
    for i in 1..=9 {
        actions.insert(format!("key.hotbar.{}", i), format!("快捷栏第{}格", i));
    }
    
    actions.insert("key.saveToolbarActivator".to_string(), "保存快捷栏激活键".to_string());
    actions.insert("key.loadToolbarActivator".to_string(), "加载快捷栏激活键".to_string());
    actions.insert("key.advancements".to_string(), "打开进度界面".to_string());
    actions.insert("key.command".to_string(), "打开命令栏".to_string());
    actions.insert("key.socialInteractions".to_string(), "多人联机社交交互".to_string());

    KeyboardLocalization {
        metadata: KeyboardLocalizationMetadata {
            authors: vec!["Antigravity".to_string(), "MrShellad".to_string()],
            created_at: "2026-06-03".to_string(),
            updated_at: "2026-06-03".to_string(),
            version: "1.0.0".to_string(),
        },
        keys,
        actions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pilauncher-keymap-test-{}-{}",
            label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    #[test]
    fn test_get_default_zh_cn_localization() {
        let loc = get_default_zh_cn_localization();
        assert_eq!(loc.metadata.version, "1.0.0");
        assert!(loc.metadata.authors.contains(&"Antigravity".to_string()));
        assert_eq!(loc.keys.get("key.keyboard.space").unwrap(), "空格键");
        assert_eq!(loc.actions.get("key.forward").unwrap(), "向前移动");
    }

    #[test]
    fn test_parse_keybindings_success() {
        let temp_dir = unique_test_root("parse-success");
        fs::create_dir_all(&temp_dir).unwrap();
        let options_path = temp_dir.join("options.txt");

        let content = "\
graphicsMode:1
ao:2
key_key.forward:key.keyboard.w
key_key.back:key.keyboard.s
key_key.jump:key.keyboard.space
bobView:true
key_key.sneak:42
";
        fs::write(&options_path, content).unwrap();

        // Manual parsing similar to get_instance_keybindings logic
        let parsed_content = fs::read_to_string(&options_path).unwrap();
        let mut keybindings = Vec::new();
        for line in parsed_content.lines() {
            let line = line.trim();
            if line.starts_with("key_") {
                if let Some(pos) = line.find(':') {
                    let name = line[4..pos].to_string();
                    let key = line[pos + 1..].to_string();
                    keybindings.push(KeyBind { name, key });
                }
            }
        }

        assert_eq!(keybindings.len(), 4);
        assert_eq!(keybindings[0], KeyBind { name: "key.forward".to_string(), key: "key.keyboard.w".to_string() });
        assert_eq!(keybindings[1], KeyBind { name: "key.back".to_string(), key: "key.keyboard.s".to_string() });
        assert_eq!(keybindings[2], KeyBind { name: "key.jump".to_string(), key: "key.keyboard.space".to_string() });
        assert_eq!(keybindings[3], KeyBind { name: "key.sneak".to_string(), key: "42".to_string() });

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_save_keybindings_modifies_existing_and_preserves_others() {
        let temp_dir = unique_test_root("save-modify");
        fs::create_dir_all(&temp_dir).unwrap();
        let options_path = temp_dir.join("options.txt");

        let original_content = "\
graphicsMode:1
ao:2
key_key.forward:key.keyboard.w
key_key.back:key.keyboard.s
bobView:true
";
        fs::write(&options_path, original_content).unwrap();

        // Simulate save_instance_keybindings
        let new_keybinds = vec![
            KeyBind { name: "key.forward".to_string(), key: "key.keyboard.up".to_string() }, // modified
            KeyBind { name: "key.jump".to_string(), key: "key.keyboard.space".to_string() },  // added
        ];

        let mut lines = Vec::new();
        if options_path.exists() {
            let content = fs::read_to_string(&options_path).unwrap();
            lines = content.lines().map(|s| s.to_string()).collect();
        }

        for kb in new_keybinds {
            let target_prefix = format!("key_{}:", kb.name);
            let target_line = format!("key_{}:{}", kb.name, kb.key);
            let mut found = false;
            for line in &mut lines {
                if line.starts_with(&target_prefix) {
                    *line = target_line.clone();
                    found = true;
                    break;
                }
            }
            if !found {
                lines.push(target_line);
            }
        }

        let new_content = lines.join("\n") + "\n";
        fs::write(&options_path, new_content).unwrap();

        // Verify content
        let updated_content = fs::read_to_string(&options_path).unwrap();
        assert!(updated_content.contains("graphicsMode:1"));
        assert!(updated_content.contains("ao:2"));
        assert!(updated_content.contains("bobView:true"));
        assert!(updated_content.contains("key_key.forward:key.keyboard.up"));
        assert!(updated_content.contains("key_key.back:key.keyboard.s"));
        assert!(updated_content.contains("key_key.jump:key.keyboard.space"));

        let _ = fs::remove_dir_all(temp_dir);
    }
}
