use crate::services::config_service::DownloadSettings;

fn normalize_source_base(url: &str) -> Option<String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn push_unique(urls: &mut Vec<String>, url: String) {
    if !urls.iter().any(|existing| existing == &url) {
        urls.push(url);
    }
}

fn replace_prefix(original: &str, from: &str, to: &str) -> Option<String> {
    original
        .strip_prefix(from)
        .map(|suffix| format!("{}{}", to, suffix))
}

fn replace_trailing_segment(base: &str, from: &str, to: &str) -> Option<String> {
    let suffix = format!("/{}", from);
    base.strip_suffix(&suffix)
        .map(|prefix| format!("{}/{}", prefix, to))
}

fn vanilla_library_bases(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut bases = Vec::new();
    let official = "https://libraries.minecraft.net";
    let default_mirror = "https://bmclapi2.bangbang93.com/maven";

    match dl_settings.vanilla_source.as_str() {
        "official" | "mojang" => {
            push_unique(&mut bases, official.to_string());
            push_unique(&mut bases, default_mirror.to_string());
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.vanilla_source_url) {
                if base.ends_with("/maven") {
                    push_unique(&mut bases, base);
                } else {
                    push_unique(&mut bases, format!("{}/maven", base));
                }
            }
            push_unique(&mut bases, default_mirror.to_string());
            push_unique(&mut bases, official.to_string());
        }
    }

    bases
}

fn fabric_library_bases(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut bases = Vec::new();
    let official = "https://maven.fabricmc.net";

    match dl_settings.fabric_source.as_str() {
        "official" => {
            push_unique(&mut bases, official.to_string());
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.fabric_source_url) {
                if let Some(maven_base) = replace_trailing_segment(&base, "fabric-meta", "maven") {
                    push_unique(&mut bases, maven_base);
                } else if base.ends_with("/maven") {
                    push_unique(&mut bases, base);
                } else {
                    push_unique(&mut bases, format!("{}/maven", base));
                }
            }
            push_unique(&mut bases, official.to_string());
        }
    }

    bases
}

fn forge_library_bases(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut bases = Vec::new();
    let official = "https://maven.minecraftforge.net";
    let default_mirror = "https://bmclapi2.bangbang93.com/maven";

    match dl_settings.forge_source.as_str() {
        "official" => {
            push_unique(&mut bases, official.to_string());
            push_unique(&mut bases, default_mirror.to_string());
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.forge_source_url) {
                if let Some(maven_base) = replace_trailing_segment(&base, "forge", "maven") {
                    push_unique(&mut bases, maven_base);
                } else if base.ends_with("/maven") {
                    push_unique(&mut bases, base);
                } else {
                    push_unique(&mut bases, format!("{}/maven", base));
                }
            }
            push_unique(&mut bases, default_mirror.to_string());
            push_unique(&mut bases, official.to_string());
        }
    }

    bases
}

fn neoforge_library_bases(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut bases = Vec::new();
    let official = "https://maven.neoforged.net/releases";
    let default_mirror = "https://bmclapi2.bangbang93.com/maven";

    match dl_settings.neoforge_source.as_str() {
        "official" => {
            push_unique(&mut bases, official.to_string());
            push_unique(&mut bases, default_mirror.to_string());
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.neoforge_source_url) {
                if let Some(maven_base) = replace_trailing_segment(&base, "neoforge", "maven") {
                    push_unique(&mut bases, maven_base);
                } else if base.ends_with("/maven") {
                    push_unique(&mut bases, base);
                } else {
                    push_unique(&mut bases, format!("{}/maven", base));
                }
            }
            push_unique(&mut bases, default_mirror.to_string());
            push_unique(&mut bases, official.to_string());
        }
    }

    bases
}

fn quilt_library_bases(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut bases = Vec::new();
    let official = "https://maven.quiltmc.org/repository/release";

    match dl_settings.quilt_source.as_str() {
        "official" => {
            push_unique(&mut bases, official.to_string());
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.quilt_source_url) {
                if base.ends_with("/repository/release") {
                    push_unique(&mut bases, base);
                } else if let Some(maven_base) =
                    replace_trailing_segment(&base, "quilt-meta", "repository/release")
                {
                    push_unique(&mut bases, maven_base);
                } else {
                    push_unique(&mut bases, format!("{}/repository/release", base));
                }
            }
            push_unique(&mut bases, official.to_string());
        }
    }

    bases
}

pub fn route_library_urls(original: &str, dl_settings: &DownloadSettings) -> Vec<String> {
    let mut urls = Vec::new();

    let mappings = [
        (
            "https://libraries.minecraft.net",
            vanilla_library_bases(dl_settings),
        ),
        (
            "https://maven.fabricmc.net",
            fabric_library_bases(dl_settings),
        ),
        (
            "https://maven.minecraftforge.net",
            forge_library_bases(dl_settings),
        ),
        (
            "https://maven.neoforged.net/releases",
            neoforge_library_bases(dl_settings),
        ),
        (
            "https://maven.quiltmc.org/repository/release",
            quilt_library_bases(dl_settings),
        ),
    ];

    for (official_base, candidate_bases) in mappings {
        if original.starts_with(official_base) {
            for base in candidate_bases {
                if base == official_base {
                    push_unique(&mut urls, original.to_string());
                } else if let Some(candidate) = replace_prefix(original, official_base, &base) {
                    push_unique(&mut urls, candidate);
                }
            }
            return urls;
        }
    }

    push_unique(&mut urls, original.to_string());
    urls
}

pub fn route_assets_index_urls(original: &str, dl_settings: &DownloadSettings) -> Vec<String> {
    let mut urls = Vec::new();
    let official_base = if original.starts_with("https://piston-meta.mojang.com") {
        "https://piston-meta.mojang.com"
    } else {
        "https://launchermeta.mojang.com"
    };
    let default_mirror = "https://bmclapi2.bangbang93.com";

    match dl_settings.vanilla_source.as_str() {
        "official" | "mojang" => {
            push_unique(&mut urls, original.to_string());
            if let Some(candidate) = replace_prefix(original, official_base, default_mirror) {
                push_unique(&mut urls, candidate);
            }
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.vanilla_source_url) {
                if let Some(candidate) = replace_prefix(original, official_base, &base) {
                    push_unique(&mut urls, candidate);
                }
            }
            if let Some(candidate) = replace_prefix(original, official_base, default_mirror) {
                push_unique(&mut urls, candidate);
            }
            push_unique(&mut urls, original.to_string());
        }
    }

    if urls.is_empty() {
        push_unique(&mut urls, original.to_string());
    }

    urls
}

pub fn route_asset_object_urls(
    prefix: &str,
    hash: &str,
    dl_settings: &DownloadSettings,
) -> Vec<String> {
    let mut urls = Vec::new();
    let official = format!(
        "https://resources.download.minecraft.net/{}/{}",
        prefix, hash
    );
    let default_mirror = format!("https://bmclapi2.bangbang93.com/assets/{}/{}", prefix, hash);

    match dl_settings.vanilla_source.as_str() {
        "official" | "mojang" => {
            push_unique(&mut urls, official);
            push_unique(&mut urls, default_mirror);
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.vanilla_source_url) {
                push_unique(&mut urls, format!("{}/assets/{}/{}", base, prefix, hash));
            }
            push_unique(&mut urls, default_mirror);
            push_unique(
                &mut urls,
                format!(
                    "https://resources.download.minecraft.net/{}/{}",
                    prefix, hash
                ),
            );
        }
    }

    urls
}

fn source_base_candidates(
    selected_source: &str,
    selected_url: &str,
    official_base: &str,
    mirror_base: Option<&str>,
) -> Vec<String> {
    let mut bases = Vec::new();

    if let Some(base) = normalize_source_base(selected_url) {
        push_unique(&mut bases, base);
    }

    match selected_source {
        "official" => {
            push_unique(&mut bases, official_base.to_string());
            if let Some(mirror_base) = mirror_base {
                push_unique(&mut bases, mirror_base.to_string());
            }
        }
        "bmclapi" => {
            if let Some(mirror_base) = mirror_base {
                push_unique(&mut bases, mirror_base.to_string());
            }
            push_unique(&mut bases, official_base.to_string());
        }
        _ => {
            if let Some(mirror_base) = mirror_base {
                push_unique(&mut bases, mirror_base.to_string());
            }
            push_unique(&mut bases, official_base.to_string());
        }
    }

    if bases.is_empty() {
        push_unique(&mut bases, official_base.to_string());
        if let Some(mirror_base) = mirror_base {
            push_unique(&mut bases, mirror_base.to_string());
        }
    }

    bases
}

pub fn route_vanilla_version_manifest_urls(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut urls = Vec::new();
    let official = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json".to_string();
    let default_mirror = "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json".to_string();

    match dl_settings.vanilla_source.as_str() {
        "official" | "mojang" => {
            push_unique(&mut urls, official);
            push_unique(&mut urls, default_mirror);
        }
        _ => {
            if let Some(base) = normalize_source_base(&dl_settings.vanilla_source_url) {
                push_unique(&mut urls, format!("{}/mc/game/version_manifest_v2.json", base));
            }
            push_unique(&mut urls, official);
            push_unique(&mut urls, default_mirror);
        }
    }
    urls
}

pub fn route_vanilla_version_json_urls(version_url: &str, dl_settings: &DownloadSettings) -> Vec<String> {
    let mut urls = Vec::new();
    let selected_url = if dl_settings.vanilla_source == "official" {
        version_url.to_string()
    } else {
        version_url.replace(
            "https://piston-meta.mojang.com",
            &dl_settings.vanilla_source_url,
        )
    };
    push_unique(&mut urls, selected_url);

    if dl_settings.auto_check_latency {
        push_unique(
            &mut urls,
            version_url.replace(
                "https://piston-meta.mojang.com",
                "https://bmclapi2.bangbang93.com",
            ),
        );
        push_unique(&mut urls, version_url.to_string());
    }
    urls
}

pub fn route_vanilla_jar_urls(jar_url: &str, dl_settings: &DownloadSettings) -> Vec<String> {
    let mut urls = Vec::new();
    let mirror_jar_url = if dl_settings.vanilla_source == "official" {
        jar_url.to_string()
    } else {
        jar_url.replace(
            "https://piston-data.mojang.com",
            &dl_settings.vanilla_source_url,
        )
    };
    push_unique(&mut urls, mirror_jar_url);

    if dl_settings.vanilla_source != "official" {
        push_unique(&mut urls, jar_url.to_string());
    }

    if dl_settings.auto_check_latency {
        let bmcl_url = jar_url.replace(
            "https://piston-data.mojang.com",
            "https://bmclapi2.bangbang93.com",
        );
        push_unique(&mut urls, bmcl_url);
    }
    urls
}

pub fn route_fabric_profile_urls(
    mc_version: &str,
    loader_version: &str,
    dl_settings: &DownloadSettings,
) -> Vec<String> {
    const FABRIC_OFFICIAL_BASE: &str = "https://meta.fabricmc.net";
    const FABRIC_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/fabric-meta";

    source_base_candidates(
        &dl_settings.fabric_source,
        &dl_settings.fabric_source_url,
        FABRIC_OFFICIAL_BASE,
        Some(FABRIC_BMCLAPI_BASE),
    )
    .into_iter()
    .map(|base| {
        format!(
            "{}/v2/versions/loader/{}/{}/profile/json",
            base, mc_version, loader_version
        )
    })
    .collect()
}

fn append_forge_installer_urls(
    urls: &mut Vec<String>,
    base: &str,
    mc_version: &str,
    loader_version: &str,
) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let artifact_path = format!(
        "net/minecraftforge/forge/{0}-{1}/forge-{0}-{1}-installer.jar",
        mc_version, loader_version
    );

    if let Some(maven_base) = replace_trailing_segment(&base, "forge", "maven") {
        push_unique(urls, format!("{}/{}", maven_base, artifact_path));
    }

    push_unique(urls, format!("{}/{}", base, artifact_path));
}

pub fn route_forge_installer_urls(
    mc_version: &str,
    loader_version: &str,
    dl_settings: &DownloadSettings,
) -> Vec<String> {
    const FORGE_OFFICIAL_BASE: &str = "https://maven.minecraftforge.net";
    const FORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/forge";

    let mut urls = Vec::new();
    for base in source_base_candidates(
        &dl_settings.forge_source,
        &dl_settings.forge_source_url,
        FORGE_OFFICIAL_BASE,
        Some(FORGE_BMCLAPI_BASE),
    ) {
        append_forge_installer_urls(&mut urls, &base, mc_version, loader_version);
    }
    urls
}

fn append_neoforge_installer_urls(urls: &mut Vec<String>, base: &str, loader_version: &str) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let artifact_path = format!(
        "net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar",
        loader_version
    );

    if let Some(maven_base) = replace_trailing_segment(&base, "neoforge", "maven") {
        push_unique(urls, format!("{}/{}", maven_base, artifact_path));
    }

    push_unique(urls, format!("{}/{}", base, artifact_path));
}

pub fn route_neoforge_installer_urls(
    loader_version: &str,
    dl_settings: &DownloadSettings,
) -> Vec<String> {
    const NEOFORGE_OFFICIAL_BASE: &str = "https://maven.neoforged.net/releases";
    const NEOFORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/neoforge";

    let mut urls = Vec::new();
    for base in source_base_candidates(
        &dl_settings.neoforge_source,
        &dl_settings.neoforge_source_url,
        NEOFORGE_OFFICIAL_BASE,
        Some(NEOFORGE_BMCLAPI_BASE),
    ) {
        append_neoforge_installer_urls(&mut urls, &base, loader_version);
    }
    urls
}

fn append_neoforge_list_url(urls: &mut Vec<String>, base: &str, mc_version: &str) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let list_base = if base.ends_with("/neoforge") {
        Some(base)
    } else if base.ends_with("/maven") {
        replace_trailing_segment(&base, "maven", "neoforge")
    } else if base.contains("bangbang93.com") {
        Some(format!("{}/neoforge", base))
    } else {
        None
    };

    if let Some(list_base) = list_base {
        push_unique(urls, format!("{}/list/{}", list_base, mc_version));
    }
}

pub fn route_neoforge_list_urls(
    mc_version: &str,
    dl_settings: &DownloadSettings,
) -> Vec<String> {
    const NEOFORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/neoforge";

    let mut urls = Vec::new();

    if let Some(base) = normalize_source_base(&dl_settings.neoforge_source_url) {
        append_neoforge_list_url(&mut urls, &base, mc_version);
    }

    append_neoforge_list_url(&mut urls, NEOFORGE_BMCLAPI_BASE, mc_version);
    urls
}

pub fn route_quilt_profile_urls(
    mc_version: &str,
    loader_version: &str,
    dl_settings: &DownloadSettings,
) -> Vec<String> {
    const QUILT_OFFICIAL_BASE: &str = "https://meta.quiltmc.org";

    source_base_candidates(
        &dl_settings.quilt_source,
        &dl_settings.quilt_source_url,
        QUILT_OFFICIAL_BASE,
        None,
    )
    .into_iter()
    .map(|base| {
        format!(
            "{}/v3/versions/loader/{}/{}/profile/json",
            base, mc_version, loader_version
        )
    })
    .collect()
}
