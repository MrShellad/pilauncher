use std::{
    env, fs,
    path::{Path, PathBuf},
};

const CLIENT_ID_KEY: &str = "MICROSOFT_CLIENT_ID";
const CURSEFORGE_KEY: &str = "CURSEFORGE_API_KEY";
const VITE_CURSEFORGE_KEY: &str = "VITE_CURSEFORGE_API_KEY";

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let root_env_path = manifest_dir
        .parent()
        .expect("src-tauri should have a project root parent")
        .join(".env");

    println!("cargo:rerun-if-changed={}", root_env_path.display());
    println!("cargo:rerun-if-env-changed={CLIENT_ID_KEY}");
    println!("cargo:rerun-if-env-changed={CURSEFORGE_KEY}");
    println!("cargo:rerun-if-env-changed={VITE_CURSEFORGE_KEY}");

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

    // Optional: CurseForge API key for modpack import.
    // Do NOT hardcode in repo; inject via build environment (CI secrets) or local .env (gitignored).
    if let Some(key) = env::var(CURSEFORGE_KEY)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| read_env_value(&root_env_path, CURSEFORGE_KEY))
        .or_else(|| read_env_value(&root_env_path, VITE_CURSEFORGE_KEY))
    {
        println!("cargo:rustc-env={CURSEFORGE_KEY}={key}");
        // also provide the Vite-prefixed name for any code paths expecting it
        println!("cargo:rustc-env={VITE_CURSEFORGE_KEY}={key}");
    }

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
