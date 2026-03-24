// src-tauri/src/services/qrcode_service.rs
use base64::{engine::general_purpose::STANDARD, Engine as _};
use qrcodegen::{QrCode, QrCodeEcc};

pub fn generate_qr_data_uri(text: &str) -> Result<String, String> {
    // 生成二维码，容错率设为 Medium
    let qr = QrCode::encode_text(text, QrCodeEcc::Medium).map_err(|e| e.to_string())?;

    // 边距设置
    let border: i32 = 2;
    let size = qr.size() + border * 2;

    // 手动构建无损的高清 SVG 矢量图
    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {0} {0}\" fill=\"none\" stroke=\"none\">\n",
        size
    );
    svg.push_str("<rect width=\"100%\" height=\"100%\" fill=\"#FFFFFF\"/>\n");
    svg.push_str("<path d=\"");

    for y in 0..qr.size() {
        for x in 0..qr.size() {
            if qr.get_module(x, y) {
                svg.push_str(&format!("M{} {}h1v1h-1z ", x + border, y + border));
            }
        }
    }
    svg.push_str("\" fill=\"#000000\"/>\n</svg>");

    // 将 SVG 转为 Base64 的 Data URI 格式，供前端 <img> 标签直接秒加载
    let base64_svg = STANDARD.encode(svg.as_bytes());
    Ok(format!("data:image/svg+xml;base64,{}", base64_svg))
}
