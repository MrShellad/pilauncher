use super::LaunchCommandBuilder;
use serde_json::Value;
use std::env;

impl LaunchCommandBuilder {
    pub(super) fn current_os() -> &'static str {
        match env::consts::OS {
            "windows" => "windows",
            "macos" => "osx",
            "linux" => "linux",
            _ => env::consts::OS,
        }
    }

    pub(super) fn current_arch() -> &'static str {
        match env::consts::ARCH {
            "x86_64" => "64",
            "x86" => "32",
            "aarch64" => "arm64",
            _ => env::consts::ARCH,
        }
    }

    pub(super) fn classifier_matches_os(key: &str, current_os: &str) -> bool {
        key.contains(current_os) || (current_os == "osx" && key.contains("macos"))
    }

    pub(super) fn check_rules(rules: Option<&Vec<Value>>) -> bool {
        if let Some(rules_arr) = rules {
            let mut result = false;
            for rule in rules_arr {
                let action = rule["action"].as_str().unwrap_or("");

                let mut os_match = true;
                if let Some(os) = rule.get("os") {
                    if os.get("name").and_then(|n| n.as_str()) != Some(Self::current_os()) {
                        os_match = false;
                    }
                }

                let mut features_match = true;
                if let Some(features) = rule.get("features").and_then(|f| f.as_object()) {
                    for (feat_name, feat_val) in features {
                        let required_val = feat_val.as_bool().unwrap_or(false);

                        let our_val = match feat_name.as_str() {
                            "has_custom_resolution" => true,
                            "is_demo_user" => false,
                            "has_quick_plays_log" => false,
                            "is_quick_play_singleplayer" => false,
                            "is_quick_play_multiplayer" => false,
                            "is_quick_play_realms" => false,
                            _ => false,
                        };

                        if required_val != our_val {
                            features_match = false;
                            break;
                        }
                    }
                }

                if os_match && features_match {
                    if action == "allow" {
                        result = true;
                    } else if action == "disallow" {
                        result = false;
                    }
                }
            }
            result
        } else {
            true
        }
    }
}
