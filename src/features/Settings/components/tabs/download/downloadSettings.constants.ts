import downloadConfig from '../../../../../assets/config/downloadsource.json';
import type { DownloadSourceEntry, ProxyOption, SourceCategory } from './downloadSettings.types';

const sources = downloadConfig.sources as {
  vanilla: DownloadSourceEntry[];
  forge: DownloadSourceEntry[];
  fabric: DownloadSourceEntry[];
  neoforge: DownloadSourceEntry[];
  quilt: DownloadSourceEntry[];
};

export const INITIAL_DOWNLOAD_FOCUS_KEY = 'settings-download-minecraft-meta-source-0';

export const DOWNLOAD_SOURCE_CATEGORIES: SourceCategory[] = [
  { key: 'vanilla', label: '原版核心下载源', data: sources.vanilla },
  { key: 'forge', label: 'Forge 下载源', data: sources.forge },
  { key: 'fabric', label: 'Fabric 下载源', data: sources.fabric },
  { key: 'neoforge', label: 'NeoForge 下载源', data: sources.neoforge },
  { key: 'quilt', label: 'Quilt 下载源', data: sources.quilt }
];

export const DOWNLOAD_PROXY_OPTIONS: ProxyOption[] = [
  { label: '直连', value: 'none' },
  { label: 'HTTP', value: 'http' },
  { label: 'HTTPS', value: 'https' },
  { label: 'SOCKS5', value: 'socks5' }
];
