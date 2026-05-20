use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SkinPngInfo {
    pub width: u32,
    pub height: u32,
    pub is_legacy: bool,
}

const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

pub fn is_png(bytes: &[u8]) -> bool {
    bytes.starts_with(PNG_SIGNATURE)
}

pub fn read_png_dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    if !is_png(bytes) {
        return Err("皮肤文件不是有效的 PNG 图片".to_string());
    }

    let width_bytes: [u8; 4] = bytes
        .get(16..20)
        .and_then(|slice| slice.try_into().ok())
        .ok_or_else(|| "PNG 文件缺少有效的 IHDR 宽度信息".to_string())?;
    let height_bytes: [u8; 4] = bytes
        .get(20..24)
        .and_then(|slice| slice.try_into().ok())
        .ok_or_else(|| "PNG 文件缺少有效的 IHDR 高度信息".to_string())?;
    let width = u32::from_be_bytes(width_bytes);
    let height = u32::from_be_bytes(height_bytes);

    Ok((width, height))
}

pub fn validate_skin_png_bytes(bytes: &[u8]) -> Result<SkinPngInfo, String> {
    let (width, height) = read_png_dimensions(bytes)?;

    if width != 64 || (height != 64 && height != 32) {
        return Err(format!(
            "皮肤尺寸不受支持，当前是 {}x{}。仅支持 Minecraft 标准 64x64 或旧版 64x32 PNG。",
            width, height
        ));
    }

    Ok(SkinPngInfo {
        width,
        height,
        is_legacy: height == 32,
    })
}

pub fn validate_skin_png_file(path: &Path) -> Result<SkinPngInfo, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取皮肤文件失败: {}", e))?;
    validate_skin_png_bytes(&bytes)
}

pub fn is_valid_skin_png_bytes(bytes: &[u8]) -> bool {
    validate_skin_png_bytes(bytes).is_ok()
}

pub fn is_valid_skin_png_file(path: &Path) -> bool {
    validate_skin_png_file(path).is_ok()
}
