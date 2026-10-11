import type { LucideIcon } from 'lucide-react';

import type { DownloadSource, FilterOption, TabType } from '../hooks/useResourceDownload';
import type { FilterKey } from './FilterBar.constants';

export interface DownloadTabConfig {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

export interface FilterBarProps {
  activeTab: TabType;
  tabs: DownloadTabConfig[];
  onTabChange: (tab: TabType) => void;
  query: string;
  setQuery: (value: string) => void;
  source: DownloadSource;
  setSource: (value: DownloadSource) => void;
  mcVersion: string;
  setMcVersion: (value: string) => void;
  loaderType: string;
  setLoaderType: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  mcVersionOptions: FilterOption[];
  categoryOptions: FilterOption[];
  isCurseForgeAvailable: boolean;
  onSearch: () => void;
  onReset: () => void;
}

export type FilterArrowHandler = (key: FilterKey) => (direction: string) => boolean;
