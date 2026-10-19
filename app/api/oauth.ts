import { useHttp, unwrap, type Envelope } from './http'

export interface OAuthServiceDTO {
  appKey: string
  displayName: string
  connected: boolean
  status: string | null
  scope: string | null
  expiresAt: string | null
}

export interface OAuthAuthorizeDTO {
  authorizationUrl: string
  expiresAt: string
}

export const useOAuthApi = () => {
  const { $api } = useHttp()

  const oauthApi = {
    async getServices(): Promise<OAuthServiceDTO[]> {
      const resp = await $api<OAuthServiceDTO[] | Envelope<OAuthServiceDTO[]>>('/oauth', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async getService(appKey: string): Promise<OAuthServiceDTO> {
      const resp = await $api<OAuthServiceDTO | Envelope<OAuthServiceDTO>>(`/oauth/${encodeURIComponent(appKey)}`, {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async authorize(appKey: string): Promise<OAuthAuthorizeDTO> {
      const resp = await $api<OAuthAuthorizeDTO | Envelope<OAuthAuthorizeDTO>>(`/oauth/${encodeURIComponent(appKey)}/authorize`, {
        method: 'POST',
      })
      return unwrap(resp)
    },

    async revokeAuthorization(appKey: string): Promise<void> {
      const resp = await $api<unknown | Envelope<unknown>>(`/oauth/${encodeURIComponent(appKey)}/authorization`, {
        method: 'DELETE',
      })
      unwrap(resp)
    },
  }

  return { oauthApi }
}
