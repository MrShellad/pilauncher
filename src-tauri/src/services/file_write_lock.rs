// 按目标路径串行化文件写入，避免并发写同一文件导致损坏（如多任务同时下载到同一路径）
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex as StdMutex;
use tokio::sync::Mutex as TokioMutex;

static FILE_WRITE_LOCKS: Lazy<StdMutex<HashMap<String, std::sync::Arc<TokioMutex<()>>>>> =
    Lazy::new(|| StdMutex::new(HashMap::new()));

pub fn lock_for_path(path_key: &str) -> std::sync::Arc<TokioMutex<()>> {
    let mut m = FILE_WRITE_LOCKS.lock().unwrap();
    m.entry(path_key.to_string())
        .or_insert_with(|| std::sync::Arc::new(TokioMutex::new(())))
        .clone()
}
