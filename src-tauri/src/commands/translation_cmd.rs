use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Duration;

type HmacSha256 = Hmac<Sha256>;

const TMT_MAX_SOURCE_CHARS: usize = 2000;
const TMT_SAFE_CHUNK_CHARS: usize = 1800;
const TMT_ACTION: &str = "TextTranslate";
const TMT_VERSION: &str = "2018-03-21";
const TMT_SERVICE: &str = "tmt";

#[derive(Debug, Clone)]
struct TmtConfig {
    api_url: String,
    secret_id: String,
    secret_key: String,
    region: String,
    project_id: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]
struct TmtTranslateRequest<'a> {
    source_text: &'a str,
    source: &'a str,
    target: &'a str,
    project_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TmtError {
    code: String,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TmtResponseBody {
    response: TmtResponsePayload,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TmtResponsePayload {
    target_text: Option<String>,
    source: Option<String>,
    target: Option<String>,
    error: Option<TmtError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateTextResponse {
    translated_text: String,
    source: String,
    target: String,
    chunks: usize,
}

fn read_config_value(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| match key {
            "TMT_API_URL" => option_env!("TMT_API_URL").map(str::to_string),
            "TMT_SECRET_ID" => option_env!("TMT_SECRET_ID").map(str::to_string),
            "TMT_SECRET_KEY" => option_env!("TMT_SECRET_KEY").map(str::to_string),
            "TMT_REGION" => option_env!("TMT_REGION").map(str::to_string),
            "TMT_PROJECT_ID" => option_env!("TMT_PROJECT_ID").map(str::to_string),
            _ => None,
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn load_tmt_config(
    secret_id_opt: Option<String>,
    secret_key_opt: Option<String>,
) -> Result<TmtConfig, String> {
    let api_url = read_config_value("TMT_API_URL")
        .ok_or_else(|| "TMT_API_URL is not configured in .env or environment.".to_string())?;
    
    let secret_id = secret_id_opt
        .filter(|s| !s.trim().is_empty())
        .or_else(|| read_config_value("TMT_SECRET_ID"))
        .ok_or_else(|| "TMT_SECRET_ID is not configured in .env, environment, or settings.".to_string())?;
        
    let secret_key = secret_key_opt
        .filter(|s| !s.trim().is_empty())
        .or_else(|| read_config_value("TMT_SECRET_KEY"))
        .ok_or_else(|| "TMT_SECRET_KEY is not configured in .env, environment, or settings.".to_string())?;

    let region = read_config_value("TMT_REGION")
        .ok_or_else(|| "TMT_REGION is not configured in .env or environment.".to_string())?;
    let project_id = read_config_value("TMT_PROJECT_ID")
        .unwrap_or_else(|| "0".to_string())
        .parse::<i64>()
        .map_err(|_| "TMT_PROJECT_ID must be an integer.".to_string())?;

    Ok(TmtConfig {
        api_url,
        secret_id,
        secret_key,
        region,
        project_id,
    })
}

fn sha256_hex(input: impl AsRef<[u8]>) -> String {
    let digest = Sha256::digest(input.as_ref());
    hex::encode(digest)
}

fn hmac_sha256(key: &[u8], message: &str) -> Result<Vec<u8>, String> {
    let mut mac = HmacSha256::new_from_slice(key)
        .map_err(|error| format!("Failed to initialize HMAC: {}", error))?;
    mac.update(message.as_bytes());
    Ok(mac.finalize().into_bytes().to_vec())
}

fn create_tmt_authorization(
    config: &TmtConfig,
    host: &str,
    canonical_uri: &str,
    payload: &str,
    timestamp: i64,
) -> Result<String, String> {
    let date = chrono::DateTime::from_timestamp(timestamp, 0)
        .ok_or_else(|| "Invalid request timestamp.".to_string())?
        .format("%Y-%m-%d")
        .to_string();
    let signed_headers = "content-type;host;x-tc-action";
    let canonical_headers = format!(
        "content-type:application/json; charset=utf-8\nhost:{}\nx-tc-action:{}\n",
        host,
        TMT_ACTION.to_lowercase()
    );
    let hashed_request_payload = sha256_hex(payload);
    let canonical_request = format!(
        "POST\n{}\n\n{}\n{}\n{}",
        canonical_uri, canonical_headers, signed_headers, hashed_request_payload
    );
    let credential_scope = format!("{}/{}/tc3_request", date, TMT_SERVICE);
    let string_to_sign = format!(
        "TC3-HMAC-SHA256\n{}\n{}\n{}",
        timestamp,
        credential_scope,
        sha256_hex(canonical_request)
    );

    let secret_date = hmac_sha256(format!("TC3{}", config.secret_key).as_bytes(), &date)?;
    let secret_service = hmac_sha256(&secret_date, TMT_SERVICE)?;
    let secret_signing = hmac_sha256(&secret_service, "tc3_request")?;
    let signature = hex::encode(hmac_sha256(&secret_signing, &string_to_sign)?);

    Ok(format!(
        "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        config.secret_id, credential_scope, signed_headers, signature
    ))
}

fn split_by_char_limit(text: &str, limit: usize) -> Vec<String> {
    if text.trim().is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for line in text.split_inclusive('\n') {
        let line_len = line.chars().count();
        if line_len > limit {
            if !current.is_empty() {
                chunks.push(std::mem::take(&mut current));
            }

            let mut segment = String::new();
            for ch in line.chars() {
                if segment.chars().count() >= limit {
                    chunks.push(std::mem::take(&mut segment));
                }
                segment.push(ch);
            }
            if !segment.is_empty() {
                current = segment;
            }
            continue;
        }

        if !current.is_empty() && current.chars().count() + line_len > limit {
            chunks.push(std::mem::take(&mut current));
        }
        current.push_str(line);
    }

    if !current.is_empty() {
        chunks.push(current);
    }

    chunks
}

async fn translate_tmt_chunk(
    client: &reqwest::Client,
    config: &TmtConfig,
    endpoint: &Url,
    text: &str,
    source: &str,
    target: &str,
) -> Result<TmtResponsePayload, String> {
    if text.chars().count() > TMT_MAX_SOURCE_CHARS {
        return Err(format!(
            "TMT source text chunk exceeds {} characters.",
            TMT_MAX_SOURCE_CHARS
        ));
    }

    let host = endpoint
        .host_str()
        .ok_or_else(|| "TMT_API_URL must include a host.".to_string())?;
    if endpoint.query().is_some() {
        return Err("TMT_API_URL must not include query parameters.".to_string());
    }
    let canonical_uri = if endpoint.path().is_empty() {
        "/"
    } else {
        endpoint.path()
    };

    let request = TmtTranslateRequest {
        source_text: text,
        source,
        target,
        project_id: config.project_id,
    };
    let payload = serde_json::to_string(&request)
        .map_err(|error| format!("Failed to serialize TMT request: {}", error))?;
    let timestamp = Utc::now().timestamp();
    let authorization = create_tmt_authorization(config, host, canonical_uri, &payload, timestamp)?;

    let response = client
        .post(endpoint.clone())
        .header("Authorization", authorization)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Host", host)
        .header("X-TC-Action", TMT_ACTION)
        .header("X-TC-Timestamp", timestamp.to_string())
        .header("X-TC-Version", TMT_VERSION)
        .header("X-TC-Region", &config.region)
        .body(payload)
        .send()
        .await
        .map_err(|error| format!("Failed to call TMT API: {}", error))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("Failed to read TMT response: {}", error))?;
    if !status.is_success() {
        return Err(format!("TMT API returned {}: {}", status, body_text));
    }

    let parsed: TmtResponseBody = serde_json::from_str(&body_text)
        .map_err(|error| format!("Failed to parse TMT response: {}", error))?;
    if let Some(error) = parsed.response.error {
        return Err(format!("TMT API error {}: {}", error.code, error.message));
    }

    Ok(parsed.response)
}

#[tauri::command]
pub async fn translate_changelog_tmt(
    text: String,
    source: Option<String>,
    target: Option<String>,
    secret_id: Option<String>,
    secret_key: Option<String>,
) -> Result<TranslateTextResponse, String> {
    let source_text = text.trim();
    if source_text.is_empty() {
        return Err("No changelog text to translate.".to_string());
    }

    let config = load_tmt_config(secret_id, secret_key)?;
    let endpoint =
        Url::parse(&config.api_url).map_err(|error| format!("Invalid TMT_API_URL: {}", error))?;
    if endpoint.scheme() != "https" {
        return Err("TMT_API_URL must use https.".to_string());
    }

    let source = source.unwrap_or_else(|| "auto".to_string());
    let target = target.unwrap_or_else(|| "zh".to_string());
    let chunks = split_by_char_limit(source_text, TMT_SAFE_CHUNK_CHARS);
    if chunks.is_empty() {
        return Err("No changelog text to translate.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Failed to create TMT client: {}", error))?;
    let mut translated = Vec::with_capacity(chunks.len());
    let mut detected_source = source.clone();
    let mut translated_target = target.clone();

    for (index, chunk) in chunks.iter().enumerate() {
        if index > 0 {
            tokio::time::sleep(Duration::from_millis(220)).await;
        }
        let payload =
            translate_tmt_chunk(&client, &config, &endpoint, chunk, &source, &target).await?;
        let target_text = payload
            .target_text
            .ok_or_else(|| "TMT response did not include TargetText.".to_string())?;
        detected_source = payload.source.unwrap_or_else(|| detected_source.clone());
        translated_target = payload.target.unwrap_or_else(|| translated_target.clone());
        translated.push(target_text);
    }

    Ok(TranslateTextResponse {
        translated_text: translated.join("\n"),
        source: detected_source,
        target: translated_target,
        chunks: chunks.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::{split_by_char_limit, TMT_MAX_SOURCE_CHARS};

    #[test]
    fn split_keeps_short_text_as_single_chunk() {
        let chunks = split_by_char_limit("line one\nline two", 1800);
        assert_eq!(chunks, vec!["line one\nline two".to_string()]);
    }

    #[test]
    fn split_preserves_limit_for_long_lines() {
        let text = "a".repeat(TMT_MAX_SOURCE_CHARS + 20);
        let chunks = split_by_char_limit(&text, 1800);

        assert!(chunks.len() > 1);
        assert!(chunks.iter().all(|chunk| chunk.chars().count() <= 1800));
        assert_eq!(chunks.concat(), text);
    }

    #[test]
    fn split_prefers_line_boundaries() {
        let chunks = split_by_char_limit("first\nsecond\nthird", 13);

        assert_eq!(
            chunks,
            vec!["first\nsecond\n".to_string(), "third".to_string()]
        );
    }
}
