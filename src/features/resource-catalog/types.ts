export type TabType = 'mod' | 'resourcepack' | 'shader' | 'modpack'

export type DownloadSource = 'modrinth' | 'curseforge'

export interface FilterOption {
  label: string
  value: string
  slug?: string
  translationKey?: string
  defaultLabel?: string
  labels?: Record<string, string>
}
