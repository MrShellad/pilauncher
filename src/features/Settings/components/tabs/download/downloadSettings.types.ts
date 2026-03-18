export type SourceCategoryKey = 'vanilla' | 'forge' | 'fabric' | 'neoforge';

export interface DownloadSourceEntry {
  id: string;
  name: string;
  url: string;
}

export interface SourceCategory {
  key: SourceCategoryKey;
  label: string;
  data: DownloadSourceEntry[];
}

export interface ProxyOption {
  label: string;
  value: 'none' | 'http' | 'https' | 'socks5';
}

export interface DomainTestResult {
  domain: string;
  dns: boolean;
  dns_info: string;
  tcp: boolean;
  tls: boolean;
  http: boolean;
  latency: number;
}

export interface SystemInfo {
  os: string;
  arch: string;
  cpu: string;
  memory: string;
}

export interface NetworkInfo {
  local_ip: string;
  dns_servers: string[];
}

export interface NetworkTestReport {
  domains: DomainTestResult[];
  system: SystemInfo;
  network: NetworkInfo;
  timestamp: string;
  qrcode_uri?: string;
}
