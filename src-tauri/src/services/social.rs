use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::services::auth::http::get_client;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaFriendStatus {
    pub uuid: String,
    pub xuid: Option<String>,
    pub name: String,
    pub is_online: bool,
    pub activity: String,
    pub can_join: bool,
    pub avatar_url: Option<String>,
}

pub async fn fetch_minecraft_friends_all(mc_token: &str) -> Result<Vec<JavaFriendStatus>, String> {
    let client = get_client();
    let endpoints = [
        "https://api.minecraftservices.com/friends/all",
        "https://api.minecraftservices.com/player/social/friends",
    ];

    let mut failures = Vec::new();
    for endpoint in endpoints {
        let res = match client
            .get(endpoint)
            .bearer_auth(mc_token)
            .header(reqwest::header::ACCEPT, "application/json")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                failures.push(format!("{} -> Network error: {}", endpoint, e));
                continue;
            }
        };

        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        if !status.is_success() {
            failures.push(format!("{} -> HTTP {}: {}", endpoint, status, body));
            continue;
        }

        let value: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Parse Minecraft friends failed from {}: {}", endpoint, e))?;
        return Ok(parse_minecraft_friends(value));
    }

    Err(format!(
        "Fetch Minecraft friends failed. Tried endpoints: {}",
        failures.join(" | ")
    ))
}

pub async fn fetch_xbox_peoplehub_friends(
    xsts_token: &str,
    uhs: &str,
    xuid: Option<&str>,
) -> Result<Vec<JavaFriendStatus>, String> {
    let client = get_client();
    let auth_header = format!("XBL3.0 x={};{}", uhs, xsts_token);
    let mut endpoints = Vec::new();

    if let Some(xuid) = xuid.filter(|value| !value.trim().is_empty()) {
        endpoints.push(format!(
            "https://peoplehub.directory.xboxlive.com/users/xuid({})/people/social/decoration/detail,presence,multiplayer",
            xuid.trim()
        ));
    }
    endpoints.push(
        "https://peoplehub.directory.xboxlive.com/users/me/people/social/decoration/detail,presence,multiplayer"
            .to_string(),
    );
    endpoints.push(
        "https://peoplehub.xboxlive.com/users/me/people/social/decoration/detail,presence,multiplayer"
            .to_string(),
    );

    let mut failures = Vec::new();
    for endpoint in endpoints {
        let res = match client
            .get(&endpoint)
            .header(reqwest::header::AUTHORIZATION, &auth_header)
            .header(reqwest::header::ACCEPT, "application/json")
            .header(reqwest::header::ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8")
            .header("x-xbl-contract-version", "3")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                failures.push(format!("{} -> Network error: {}", endpoint, e));
                continue;
            }
        };

        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        if !status.is_success() {
            failures.push(format!("{} -> HTTP {}: {}", endpoint, status, body));
            continue;
        }

        let value: Value = serde_json::from_str(&body)
            .map_err(|e| format!("Parse Xbox friends failed from {}: {}", endpoint, e))?;
        return Ok(parse_peoplehub_friends(value));
    }

    Err(format!(
        "Fetch Xbox friends failed. Tried endpoints: {}",
        failures.join(" | ")
    ))
}

fn parse_minecraft_friends(value: Value) -> Vec<JavaFriendStatus> {
    let empty = Vec::new();
    let source = value
        .get("friends")
        .and_then(Value::as_array)
        .or_else(|| value.get("profiles").and_then(Value::as_array))
        .or_else(|| value.as_array())
        .unwrap_or(&empty);

    let mut friends = source
        .iter()
        .filter_map(|item| {
            let uuid = pick_string(
                item,
                &["profileId", "id", "uuid", "playerId", "minecraftUuid"],
            )?;
            let name = pick_string(
                item,
                &[
                    "name",
                    "gamertag",
                    "minecraftName",
                    "profileName",
                    "displayName",
                ],
            )
            .unwrap_or_else(|| uuid.clone());

            Some(JavaFriendStatus {
                uuid,
                xuid: pick_string(item, &["xuid", "xboxUserId"]),
                name,
                is_online: false,
                activity: "Java friend".to_string(),
                can_join: false,
                avatar_url: None,
            })
        })
        .collect::<Vec<_>>();

    friends.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    friends
}

fn parse_peoplehub_friends(value: Value) -> Vec<JavaFriendStatus> {
    let empty = Vec::new();
    let source = value
        .get("people")
        .and_then(Value::as_array)
        .or_else(|| value.get("People").and_then(Value::as_array))
        .or_else(|| value.as_array())
        .unwrap_or(&empty);

    let mut friends = source
        .iter()
        .filter_map(|item| {
            let xuid = pick_string(item, &["xuid", "id"])?;
            let name = pick_string(
                item,
                &["gamertag", "modernGamertag", "displayName", "realName"],
            )
            .unwrap_or_else(|| xuid.clone());
            let is_online = pick_string(item, &["presenceState", "state"])
                .map(|state| state.eq_ignore_ascii_case("online"))
                .unwrap_or(false);

            Some(JavaFriendStatus {
                uuid: pick_string(item, &["profileId", "uuid", "minecraftUuid"])
                    .unwrap_or_else(|| xuid.clone()),
                xuid: Some(xuid),
                name,
                is_online,
                activity: peoplehub_activity(item).unwrap_or_else(|| {
                    if is_online {
                        "Xbox Live online"
                    } else {
                        "Xbox Live friend"
                    }
                    .to_string()
                }),
                can_join: peoplehub_can_join(item),
                avatar_url: pick_string(item, &["displayPicRaw", "displayPicUrl"]),
            })
        })
        .collect::<Vec<_>>();

    friends.sort_by(|a, b| {
        b.is_online
            .cmp(&a.is_online)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    friends
}

fn peoplehub_activity(item: &Value) -> Option<String> {
    pick_string(
        item,
        &[
            "presenceText",
            "presenceDetails",
            "richPresenceText",
            "titleName",
            "activity",
        ],
    )
    .filter(|value| !value.trim().is_empty())
}

fn peoplehub_can_join(item: &Value) -> bool {
    let mut strings = Vec::new();
    collect_leaf_strings(item, &mut strings);
    strings.iter().any(|text| {
        let lower = text.to_lowercase();
        lower.contains("join")
            || lower.contains("server")
            || lower.contains("host")
            || lower.contains("multiplayer")
    })
}

fn collect_leaf_strings(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::String(text) => output.push(text.clone()),
        Value::Number(number) => output.push(number.to_string()),
        Value::Array(items) => {
            for item in items {
                collect_leaf_strings(item, output);
            }
        }
        Value::Object(map) => {
            for (key, item) in map {
                output.push(key.clone());
                collect_leaf_strings(item, output);
            }
        }
        _ => {}
    }
}

fn pick_string(value: &Value, fields: &[&str]) -> Option<String> {
    for field in fields {
        if let Some(item) = value.get(*field) {
            if let Some(text) = item.as_str() {
                if !text.trim().is_empty() {
                    return Some(text.to_string());
                }
            }
            if let Some(number) = item.as_u64() {
                return Some(number.to_string());
            }
        }
    }
    None
}
