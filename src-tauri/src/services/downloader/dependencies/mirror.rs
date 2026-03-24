use crate::services::config_service::DownloadSettings;

/// 镜像路由：库文件下载地址
pub fn route_library_url(original: &str, dl_settings: &DownloadSettings) -> String {
    if dl_settings.vanilla_source == "official" {
        return original.to_string();
    }

    original
        .replace(
            "https://libraries.minecraft.net",
            "https://bmclapi2.bangbang93.com/maven",
        )
        .replace(
            "https://maven.fabricmc.net/",
            "https://bmclapi2.bangbang93.com/maven/",
        )
        .replace(
            "https://maven.minecraftforge.net/",
            "https://bmclapi2.bangbang93.com/maven/",
        )
        .replace(
            "https://maven.neoforged.net/releases/",
            "https://bmclapi2.bangbang93.com/maven/",
        )
}

/// 镜像路由：资源索引文件地址
pub fn route_assets_index_url(original: &str, dl_settings: &DownloadSettings) -> String {
    if dl_settings.vanilla_source == "official" {
        original.to_string()
    } else {
        original.replace(
            "https://launchermeta.mojang.com",
            &dl_settings.vanilla_source_url,
        )
    }
}

/// 镜像路由：单个资源对象文件地址
pub fn route_asset_object_url(prefix: &str, hash: &str, dl_settings: &DownloadSettings) -> String {
    if dl_settings.vanilla_source == "official" {
        format!(
            "https://resources.download.minecraft.net/{}/{}",
            prefix, hash
        )
    } else {
        format!(
            "{}/assets/{}/{}",
            dl_settings.vanilla_source_url, prefix, hash
        )
    }
}
