# Modpack Service

This module is split into three layers to keep responsibilities clear.

## Structure
- `logic.rs`
  - Pure logic: parsing, ID sanitization, config building, safe path checks.
- `ops.rs`
  - File and archive I/O: zip scanning, overrides extraction, instance layout/config writes.
- `orchestrator.rs`
  - Core workflow: install vanilla core, dependencies, loaders, and mod downloads.

## Public API
Re-exported in `mod.rs`:
- `parse_modpack(path: &str) -> Result<ModpackMetadata, String>`
- `execute_import(app, zip_path, instance_name, cancel) -> Result<(), String>`

## Source detection rule
If `modrinth.index.json` exists in the archive, it is treated as a Modrinth pack.
Otherwise, if `manifest.json` exists, it is treated as a CurseForge pack.

## Notes
- Mod downloads reuse the shared downloader scheduler for retries, hash checks, and temp files.
- CurseForge downloads require an API key via `VITE_CURSEFORGE_API_KEY` or `CURSEFORGE_API_KEY`.
- In dev, a `.env` file in the project root is also checked for the same keys.
- Any new feature should choose the correct layer (logic, ops, or orchestrator) to avoid cross-cutting changes.
