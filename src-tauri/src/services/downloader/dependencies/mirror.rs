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
    let official_base = "https://launchermeta.mojang.com";
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
