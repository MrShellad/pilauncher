use sha2::{Digest, Sha384};
use std::{
    env, fs,
    path::{Path, PathBuf},
};

const INITIAL_SCHEMA_MIGRATION: &str = "migrations/20260101000001_initial_schema.sql";
const TAURI_CONFIG: &str = "tauri.conf.json";
const LOCKED_INITIAL_SCHEMA_SHA384: &str =
    "2F4351D8BFDF1226B0125A0A585343653F47A3977F69324ADE7D90455F67A5579596546C20EAD73AC09FB2ACFF7C7C13";

const CLIENT_ID_KEY: &str = "MICROSOFT_CLIENT_ID";
const CURSEFORGE_KEY: &str = "CURSEFORGE_API_KEY";
const VITE_CURSEFORGE_KEY: &str = "VITE_CURSEFORGE_API_KEY";
const DONORS_API_URL_KEY: &str = "DONORS_API_URL";
const VITE_DONORS_API_URL_KEY: &str = "VITE_DONORS_API_URL";
const DONORS_API_KEY_KEY: &str = "DONORS_API_KEY";
const VITE_DONORS_API_KEY_KEY: &str = "VITE_DONORS_API_KEY";
const CLIENT_INSTALLATION_TRACK_API_URL_KEY: &str = "CLIENT_INSTALLATION_TRACK_API_URL";
const VITE_CLIENT_INSTALLATION_TRACK_API_URL_KEY: &str = "VITE_CLIENT_INSTALLATION_TRACK_API_URL";
const CLIENT_INSTALLATION_TRACK_API_KEY_KEY: &str = "CLIENT_INSTALLATION_TRACK_API_KEY";
const VITE_CLIENT_INSTALLATION_TRACK_API_KEY_KEY: &str = "VITE_CLIENT_INSTALLATION_TRACK_API_KEY";
const TMT_API_URL_KEY: &str = "TMT_API_URL";
const TMT_SECRET_ID_KEY: &str = "TMT_SECRET_ID";
const TMT_SECRET_KEY_KEY: &str = "TMT_SECRET_KEY";
const TMT_REGION_KEY: &str = "TMT_REGION";
const TMT_PROJECT_ID_KEY: &str = "TMT_PROJECT_ID";

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    verify_immutable_initial_schema(&manifest_dir);
    verify_skin_renderer_csp(&manifest_dir);
    let root_env_path = manifest_dir
        .parent()
        .expect("src-tauri should have a project root parent")
        .join(".env");

    println!("cargo:rerun-if-changed={}", root_env_path.display());
    println!("cargo:rerun-if-env-changed={CLIENT_ID_KEY}");
    println!("cargo:rerun-if-env-changed={CURSEFORGE_KEY}");
    println!("cargo:rerun-if-env-changed={VITE_CURSEFORGE_KEY}");
    println!("cargo:rerun-if-env-changed={DONORS_API_URL_KEY}");
    println!("cargo:rerun-if-env-changed={VITE_DONORS_API_URL_KEY}");
    println!("cargo:rerun-if-env-changed={DONORS_API_KEY_KEY}");
    println!("cargo:rerun-if-env-changed={VITE_DONORS_API_KEY_KEY}");
    println!("cargo:rerun-if-env-changed={CLIENT_INSTALLATION_TRACK_API_URL_KEY}");
    println!("cargo:rerun-if-env-changed={VITE_CLIENT_INSTALLATION_TRACK_API_URL_KEY}");
    println!("cargo:rerun-if-env-changed={CLIENT_INSTALLATION_TRACK_API_KEY_KEY}");
    println!("cargo:rerun-if-env-changed={VITE_CLIENT_INSTALLATION_TRACK_API_KEY_KEY}");
    println!("cargo:rerun-if-env-changed={TMT_API_URL_KEY}");
    println!("cargo:rerun-if-env-changed={TMT_SECRET_ID_KEY}");
    println!("cargo:rerun-if-env-changed={TMT_SECRET_KEY_KEY}");
    println!("cargo:rerun-if-env-changed={TMT_REGION_KEY}");
    println!("cargo:rerun-if-env-changed={TMT_PROJECT_ID_KEY}");

    let client_id = env::var(CLIENT_ID_KEY)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| read_env_value(&root_env_path, CLIENT_ID_KEY))
        .unwrap_or_else(|| {
            println!("cargo:warning=MICROSOFT_CLIENT_ID is not set in the build environment or .env; using dummy client ID.");
            "00000000-0000-0000-0000-000000000000".to_string()
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

    // Optional: Donors API URL
    if let Some(url) = read_first_env_value(
        &root_env_path,
        &[DONORS_API_URL_KEY, VITE_DONORS_API_URL_KEY],
    ) {
        println!("cargo:rustc-env={DONORS_API_URL_KEY}={url}");
    }

    // Optional: Donors API key
    if let Some(key) = read_first_env_value(
        &root_env_path,
        &[DONORS_API_KEY_KEY, VITE_DONORS_API_KEY_KEY],
    ) {
        println!("cargo:rustc-env={DONORS_API_KEY_KEY}={key}");
    }

    if let Some(url) = read_first_env_value(
        &root_env_path,
        &[
            CLIENT_INSTALLATION_TRACK_API_URL_KEY,
            VITE_CLIENT_INSTALLATION_TRACK_API_URL_KEY,
        ],
    ) {
        println!("cargo:rustc-env={CLIENT_INSTALLATION_TRACK_API_URL_KEY}={url}");
    }

    if let Some(key) = read_first_env_value(
        &root_env_path,
        &[
            CLIENT_INSTALLATION_TRACK_API_KEY_KEY,
            VITE_CLIENT_INSTALLATION_TRACK_API_KEY_KEY,
        ],
    ) {
        println!("cargo:rustc-env={CLIENT_INSTALLATION_TRACK_API_KEY_KEY}={key}");
    }

    for key in [
        TMT_API_URL_KEY,
        TMT_SECRET_ID_KEY,
        TMT_SECRET_KEY_KEY,
        TMT_REGION_KEY,
        TMT_PROJECT_ID_KEY,
    ] {
        if let Some(value) = read_first_env_value(&root_env_path, &[key]) {
            println!("cargo:rustc-env={key}={value}");
        }
    }

    // NOTE: Terracotta sidecar is temporarily disabled for CI compatibility.
    // setup_terracotta_sidecar();

    tauri_build::build()
}

fn verify_skin_renderer_csp(manifest_dir: &Path) {
    let config_path = manifest_dir.join(TAURI_CONFIG);
    println!("cargo:rerun-if-changed={}", config_path.display());

    let config = fs::read_to_string(&config_path).unwrap_or_else(|error| {
        panic!(
            "failed to read Tauri config {}: {error}",
            config_path.display()
        )
    });
    let config: serde_json::Value = serde_json::from_str(&config).unwrap_or_else(|error| {
        panic!(
            "failed to parse Tauri config {}: {error}",
            config_path.display()
        )
    });
    let csp = config
        .pointer("/app/security/csp")
        .and_then(serde_json::Value::as_str)
        .expect("app.security.csp must be a string");
    let connect_sources = csp
        .split(';')
        .map(str::trim)
        .find_map(|directive| directive.strip_prefix("connect-src"))
        .expect("app.security.csp must define connect-src")
        .split_whitespace()
        .collect::<Vec<_>>();

    for required_source in ["data:", "blob:"] {
        assert!(
            connect_sources.contains(&required_source),
            "app.security.csp connect-src must allow {required_source}; the packaged skin GLTF renderer loads embedded model buffers and animation blobs through fetch"
        );
    }
}

fn verify_immutable_initial_schema(manifest_dir: &Path) {
    let migration_path = manifest_dir.join(INITIAL_SCHEMA_MIGRATION);
    println!("cargo:rerun-if-changed={}", migration_path.display());

    let migration = fs::read(&migration_path).unwrap_or_else(|error| {
        panic!(
            "failed to read immutable migration {}: {error}",
            migration_path.display()
        )
    });
    let actual = Sha384::digest(migration)
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<String>();

    assert_eq!(
        actual, LOCKED_INITIAL_SCHEMA_SHA384,
        "published migration {INITIAL_SCHEMA_MIGRATION} was modified; restore it exactly and add a new versioned migration instead"
    );
    println!("cargo:rustc-env=PILAUNCHER_INITIAL_SCHEMA_SHA384={actual}");
}

fn read_first_env_value(env_path: &Path, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = env::var(key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| read_env_value(env_path, key))
        {
            return Some(value);
        }
    }

    None
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
