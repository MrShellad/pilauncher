use serde::Serialize;

use crate::services::auth::{microsoft, minecraft, xbox};
use crate::services::social_service::{self, JavaFriendStatus};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaFriendsAuthUpdate {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaFriendsStatusPayload {
    pub friends: Vec<JavaFriendStatus>,
    pub auth_update: JavaFriendsAuthUpdate,
}

#[tauri::command]
pub async fn get_java_friends_status(
    refresh_token: String,
) -> Result<JavaFriendsStatusPayload, String> {
    if refresh_token.trim().is_empty() {
        return Err("Java 好友在线状态需要 Microsoft 账号，请重新登录正版账号后重试".to_string());
    }

    let (ms_access_token, new_refresh_token) = microsoft::refresh_token(&refresh_token).await?;
    let xbl_token = xbox::auth_xbl(&ms_access_token).await?;
    let (minecraft_xsts_token, minecraft_uhs) = xbox::auth_xsts(&xbl_token).await?;
    let mc_access_token = minecraft::auth_minecraft(&minecraft_xsts_token, &minecraft_uhs).await?;

    let friends = match social_service::fetch_minecraft_friends_all(&mc_access_token).await {
        Ok(friends) => friends,
        Err(minecraft_error) => {
            let xbox_identity = xbox::auth_xsts_xbox_live_identity(&xbl_token).await?;
            social_service::fetch_xbox_peoplehub_friends(
                &xbox_identity.token,
                &xbox_identity.uhs,
                xbox_identity.xuid.as_deref(),
            )
            .await
            .map_err(|xbox_error| {
                format!(
                    "Minecraft Services friends failed: {}. OpenFriend PeopleHub fallback failed: {}",
                    minecraft_error, xbox_error
                )
            })?
        }
    };

    Ok(JavaFriendsStatusPayload {
        friends,
        auth_update: JavaFriendsAuthUpdate {
            access_token: mc_access_token,
            refresh_token: new_refresh_token,
            expires_at: chrono::Utc::now().timestamp() + 86400,
        },
    })
}
