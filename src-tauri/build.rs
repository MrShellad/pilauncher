use std::{
    env, fs,
    path::{Path, PathBuf},
};

const CLIENT_ID_KEY: &str = "MICROSOFT_CLIENT_ID";

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let root_env_path = manifest_dir
        .parent()
        .expect("src-tauri should have a project root parent")
        .join(".env");

    println!("cargo:rerun-if-changed={}", root_env_path.display());
    println!("cargo:rerun-if-env-changed={CLIENT_ID_KEY}");

    let client_id = env::var(CLIENT_ID_KEY)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| read_env_value(&root_env_path, CLIENT_ID_KEY))
        .unwrap_or_else(|| {
            panic!(
                "missing {CLIENT_ID_KEY}; define it in {} or in the build environment",
                root_env_path.display()
            )
        });

    println!("cargo:rustc-env={CLIENT_ID_KEY}={client_id}");

    tauri_build::build()
}

fn read_env_value(env_path: &Path, key: &str) -> Option<String> {
    let contents = fs::read_to_string(env_path).ok()?;

    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((name, value)) = line.split_once('=') else {
            continue;
        };
        if name.trim() != key {
            continue;
        }

        let value = value.trim();
        let value = if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
            value[1..value.len() - 1].to_string()
        } else {
            value.to_string()
        };

        if !value.is_empty() {
            return Some(value);
        }
    }

    None
}
