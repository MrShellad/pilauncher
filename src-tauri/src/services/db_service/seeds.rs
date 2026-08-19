use sqlx::SqlitePool;

pub const BUILTIN_ALIAS_SEEDS: &[(&str, &str, &[&str])] = &[
    ("cloth-config", "Cloth Config", &[
        "cloth-config", "cloth_config", "clothconfig",
        "cloth-config2", "cloth_config2", "clothconfig2",
        "499980", "9s6osm5g", "cloth-config-fabric", "cloth-config-forge",
    ]),
    ("fabric-api", "Fabric API", &[
        "fabric-api", "fabric_api", "fabricapi", "fabric",
        "306612", "P7dR8mBk", "fabric-api-base",
    ]),
    ("architectury", "Architectury API", &[
        "architectury", "architectury-api", "architectury_api", "architecturyapi",
        "419699", "lhGA9TYQ",
    ]),
    ("geckolib", "GeckoLib", &[
        "geckolib", "geckolib3", "geckolib4", "geckolib-fabric", "geckolib-forge",
        "388172", "8BmcYKb2", "8BmcQJ2H",
    ]),
    ("curios", "Curios API", &[
        "curios", "curios-api", "curios_api", "curiosapi", "309927", "vvuO3ImH",
    ]),
    ("jei", "Just Enough Items", &[
        "jei", "just-enough-items", "justenoughitems", "238222", "u6dRKJwZ",
    ]),
    ("rei", "Roughly Enough Items", &[
        "rei", "roughly-enough-items", "roughlyenoughitems", "310111", "nfn13YXw",
    ]),
    ("emi", "EMI", &[
        "emi", "580555", "fRiHVvU7",
    ]),
    ("patchouli", "Patchouli", &[
        "patchouli", "306770", "n6XB85cy",
    ]),
    ("citresewn", "CIT Resewn", &[
        "citresewn", "cit-resewn", "cit_resewn", "510842", "otVJHGxO",
    ]),
    ("indium", "Indium", &[
        "indium", "540608", "Orvt0mII",
    ]),
    ("iris", "Iris Shaders", &[
        "iris", "iris-shaders", "irisshaders", "455508", "YL57xq9U",
    ]),
    ("sodium", "Sodium / Embeddium", &[
        "sodium", "rubidium", "embeddium", "394468", "1103431", "908741", "AANobbMI",
    ]),
    ("kotlinforforge", "Kotlin For Forge", &[
        "kotlinforforge", "kotlin_for_forge", "kotlin-for-forge", "kff", "351264", "j0tbgP8j", "ordsPcFz",
    ]),
    ("fabric-language-kotlin", "Fabric Language Kotlin", &[
        "fabric-language-kotlin", "fabric_language_kotlin", "kotlin", "308769", "Ha28R6CL",
    ]),
    ("lithostitched", "Lithostitched", &[
        "lithostitched", "XaDC71GB", "824209",
    ]),
    ("biolith", "Biolith", &[
        "biolith", "iGEl6Crx", "852233",
    ]),
    ("terrablender", "TerraBlender", &[
        "terrablender", "563928", "mOgUt4GM",
    ]),
    ("yungs-api", "YUNG's API", &[
        "yungs-api", "yung-api", "yungsapi", "yungapi", "379965", "O5705Jpv",
    ]),
    ("balm", "Balm", &[
        "balm", "balm-fabric", "balm-forge", "balm_fabric", "balm_forge",
        "531761", "MBAknsWE",
    ]),
    ("collective", "Collective", &[
        "collective", "409026", "e0M1Uh0y",
    ]),
    ("resourceful-lib", "Resourceful Lib", &[
        "resourceful-lib", "resourcefullib", "resourceful_lib", "570073", "G1epqFG1",
    ]),
    ("owo-lib", "oωo (owo-lib)", &[
        "owo-lib", "owo", "owolib", "530898", "ccKDOlHs",
    ]),
    ("cardinal-components", "Cardinal Components", &[
        "cardinal-components", "cardinal-components-base", "cardinal_components",
        "312812", "P67965P6",
    ]),
    ("yacl", "YetAnotherConfigLib", &[
        "yacl", "yet-another-config-lib", "yetanotherconfiglib", "587483", "1eAoo2KR",
    ]),
    ("bookshelf", "Bookshelf", &[
        "bookshelf", "416954", "5ZwdcRci",
    ]),
    ("citadel", "Citadel", &[
        "citadel", "419286", "gvQqBUqZ",
    ]),
    ("puzzles-lib", "Puzzles Lib", &[
        "puzzleslib", "puzzles-lib", "puzzles_lib", "63823", "kKmKFzv5",
    ]),
    ("malilib", "MaLiLib", &[
        "malilib", "60089", "fE4bR1Sr",
    ]),
    ("appleskin", "AppleSkin", &[
        "appleskin", "248787", "rOu7bqlL",
    ]),
    ("ferritecore", "FerriteCore", &[
        "ferritecore", "504107", "NNAgCjsB",
    ]),
    ("modernfix", "ModernFix", &[
        "modernfix", "636180", "ohNO6lps",
    ]),
    ("c2me", "C2ME", &[
        "c2me", "c2me-fabric", "c2me_fabric", "437778", "PtjYWJxP",
    ]),
];

pub async fn seed_essential_aliases(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    let now = chrono::Utc::now().timestamp();

    for (canon_id, name, aliases) in BUILTIN_ALIAS_SEEDS {
        for alias in *aliases {
            sqlx::query(
                "INSERT INTO mod_aliases (alias, canonical_mod_id, display_name, source, updated_at)
                 VALUES (?, ?, ?, 'system_seed', ?)
                 ON CONFLICT(alias) DO UPDATE SET
                    canonical_mod_id = excluded.canonical_mod_id,
                    display_name = excluded.display_name,
                    updated_at = excluded.updated_at
                 WHERE source = 'system_seed';",
            )
            .bind(alias.to_lowercase())
            .bind(canon_id.to_lowercase())
            .bind(*name)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}
