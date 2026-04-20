// src-tauri/src/services/auth/http.rs
//
// 全局单例 HTTP Client 与网络错误格式化工具。
// 所有 auth 子模块共享此 Client，避免重复 TLS 握手与 DNS 解析。

use std::sync::OnceLock;
use std::time::Duration;

const USER_AGENT: &str = "PiLauncher/1.0";

/// 获取复用的全局 HTTP 客户端（避免每次新建造成反复 TLS 握手与 DNS 解析）
pub fn get_client() -> reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .user_agent(USER_AGENT)
                .timeout(Duration::from_secs(15))
                // 解决 SteamOS 等 Linux 发行版缺少系统根证书的问题 (需配合 Cargo.toml 配置)
                .use_rustls_tls()
                .build()
                .unwrap_or_default()
        })
        .clone()
}

/// 精确解析网络底层错误，抛给前端 UI 供用户排查
pub fn format_reqwest_error(context: &str, e: reqwest::Error) -> String {
    let mut err_msg = format!("{} -> ", context);

    if e.is_timeout() {
        err_msg.push_str("请求超时，请检查您的网络连接或代理设置。");
    } else if e.is_connect() {
        let inner_err = e.to_string().to_lowercase();
        if inner_err.contains("dns") || inner_err.contains("resolve") {
            err_msg
                .push_str("DNS 解析失败，建议修改电脑 DNS (如 223.5.5.5, 8.8.8.8) 或检查加速器。");
        } else if inner_err.contains("cert")
            || inner_err.contains("tls")
            || inner_err.contains("handshake")
        {
            err_msg.push_str(
                "TLS 证书校验失败！这通常是因为电脑系统时间不正确，或遭到网络劫持/防火墙阻断。",
            );
        } else {
            err_msg.push_str(&format!("无法连接到认证服务器: {}", e));
        }
    } else if e.is_decode() {
        err_msg.push_str("服务器返回的数据格式异常，可能网络正被 Portal 门户或防火墙劫持。");
    } else {
        err_msg.push_str(&format!("发生网络异常: {}", e));
    }

    err_msg
}
