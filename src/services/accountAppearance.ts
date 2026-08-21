import { convertFileSrc, invoke } from '@tauri-apps/api/core'

export interface AccountAppearanceInput {
  uuid?: string | null
  name?: string | null
  skinUrl?: string | null
  capeUrl?: string | null
}

const pendingRequests = new Map<string, Promise<string | null>>()

const stripQuery = (url?: string | null) => (url || '').split('?')[0].trim()

export const getAppearanceRevision = (url?: string | null) => {
  const query = url?.split('?')[1] || ''
  const revision = query
    .split('&')
    .map((part) => part.split('='))
    .find(([key]) => key === 't' || key === 'v')?.[1]

  return revision ? decodeURIComponent(revision) : 'init'
}

export const appendAppearanceRevision = (url: string, revision: string) =>
  `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(revision)}`

export const toAppearanceAssetUrl = (pathOrUrl: string, revision = 'init') => {
  const source = pathOrUrl.trim()
  if (!source) return null

  const url = /^(https?:|asset:|data:|blob:)/i.test(source)
    ? source
    : convertFileSrc(stripQuery(source))

  return appendAppearanceRevision(url, revision)
}

const memoize = (key: string, request: () => Promise<string>) => {
  const existing = pendingRequests.get(key)
  if (existing) return existing

  const pending = request()
    .then((value) => value || null)
    .catch(() => null)
    .finally(() => pendingRequests.delete(key))

  pendingRequests.set(key, pending)
  return pending
}

/**
 * Resolves the same cached skin file used by the 3D viewer. All callers share
 * one in-flight request, so switching panels cannot download the skin twice.
 */
export const resolveAccountSkinAsset = async (account: AccountAppearanceInput) => {
  const uuid = account.uuid?.trim()
  const source = stripQuery(account.skinUrl)
  if (!uuid || !source) return null

  const revision = getAppearanceRevision(account.skinUrl)
  const localPath = await memoize(`skin:${uuid}:${account.skinUrl || ''}`, () =>
    invoke<string>('ensure_account_skin', { uuid, skinUrl: account.skinUrl || source }),
  )

  return localPath ? toAppearanceAssetUrl(localPath, revision) : null
}

export const resolveAccountCapeAsset = async (account: AccountAppearanceInput) => {
  const uuid = account.uuid?.trim()
  const source = stripQuery(account.capeUrl)
  if (!uuid || !source) return null

  const revision = getAppearanceRevision(account.capeUrl)
  const localPath = await memoize(`cape:${uuid}:${account.capeUrl || ''}`, () =>
    invoke<string>('ensure_account_cape', { uuid, capeUrl: account.capeUrl || source }),
  )

  return localPath ? toAppearanceAssetUrl(localPath, revision) : null
}

/** Resolves the persisted account avatar with stable cache invalidation. */
export const resolveAccountAvatarAsset = async (account: AccountAppearanceInput) => {
  const uuid = account.uuid?.trim()
  const username = account.name?.trim()
  if (!uuid || !username) return null

  const revision = getAppearanceRevision(account.skinUrl)
  const localPath = await memoize(`avatar:${uuid}:${username}:${revision}`, () =>
    invoke<string>('get_or_fetch_account_avatar', { uuid, username }),
  )

  return localPath ? toAppearanceAssetUrl(localPath, revision) : null
}

export interface LanAvatarInput {
  targetIp: string
  targetPort: number
  uuid?: string | null
  username?: string | null
}

/** Prefer the LAN peer avatar, then use the shared account-avatar cache. */
export const resolveLanAvatarAsset = async ({ targetIp, targetPort, uuid, username }: LanAvatarInput) => {
  const userUuid = uuid?.trim()
  if (!userUuid) return null

  const revision = `${targetIp}:${targetPort}`
  const lanPath = await memoize(`lan-avatar:${revision}:${userUuid}`, () =>
    invoke<string>('sync_lan_avatar', { targetIp, targetPort, userUuid }),
  )
  if (lanPath) return toAppearanceAssetUrl(lanPath, revision)

  return resolveAccountAvatarAsset({ uuid: userUuid, name: username })
}
