/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CURSEFORGE_API_KEY?: string;
  readonly VITE_ONLINE_SERVERS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
