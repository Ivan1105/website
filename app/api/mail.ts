import { useHttp, unwrap, type Envelope } from './http'

export interface ImapConfigDTO {
  id: number
  displayName: string | null
  host: string
  port: number
  secure: boolean
  username: string
  hasPassword: boolean
  createdAt: string
  updatedAt: string
}

export interface MailEndpointDTO {
  host: string
  port: number
  secure: boolean
}

export interface CreateImapConfigReq {
  displayName?: string
  host: string
  port: number
  secure: boolean
  username: string
  password: string
}

export interface UpdateImapConfigReq {
  displayName?: string
  host: string
  port: number
  secure: boolean
  username: string
  password?: string
}

export interface MailTestResultDTO {
  connected: boolean
}

export type MailAccountKind = 'oauth' | 'imap'
export type MailAccountProvider = 'outlook' | 'google' | 'imap'
export type MailAccountStatus = 'available' | 'authorization_required'

export interface MailAccountDTO {
  id: string
  kind: MailAccountKind
  provider: MailAccountProvider
  displayName: string
  status: MailAccountStatus
  oauthAppKey: string | null
}

export type OutlookSubscriptionStatus =
  | 'creating'
  | 'active'
  | 'renewing'
  | 'reauthorization_required'
  | 'deleting'
  | 'disabled'
  | 'error'

export interface OutlookSubscriptionData {
  accountId: 'oauth:outlook'
  provider: 'outlook'
  enabled: boolean
  status: OutlookSubscriptionStatus
  agentId: string | null
  expiresAt: string | null
  nextRenewAt: string | null
}

export type SetOutlookSubscriptionInput =
  | { enabled: true, agentId: string }
  | { enabled: false }

export const useMailApi = () => {
  const { $api } = useHttp()

  const mailApi = {
    async getEndpoints(): Promise<MailEndpointDTO[]> {
      const resp = await $api<MailEndpointDTO[] | Envelope<MailEndpointDTO[]>>('/mail/endpoints', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async getAccounts(): Promise<MailAccountDTO[]> {
      const resp = await $api<MailAccountDTO[] | Envelope<MailAccountDTO[]>>('/mail/accounts', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async getOutlookSubscription(): Promise<OutlookSubscriptionData> {
      const resp = await $api<OutlookSubscriptionData | Envelope<OutlookSubscriptionData>>('/mail/outlook/subscription', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async setOutlookSubscription(input: SetOutlookSubscriptionInput): Promise<OutlookSubscriptionData> {
      const resp = await $api<OutlookSubscriptionData | Envelope<OutlookSubscriptionData>>('/mail/outlook/subscription', {
        method: 'POST',
        body: input,
      })
      return unwrap(resp)
    },

    async getImapConfigs(): Promise<ImapConfigDTO[]> {
      const resp = await $api<ImapConfigDTO[] | Envelope<ImapConfigDTO[]>>('/mail/imap-configs', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async createImapConfig(req: CreateImapConfigReq): Promise<ImapConfigDTO> {
      const resp = await $api<ImapConfigDTO | Envelope<ImapConfigDTO>>('/mail/imap-configs', {
        method: 'POST',
        body: req,
      })
      return unwrap(resp)
    },

    async updateImapConfig(id: number, req: UpdateImapConfigReq): Promise<void> {
      const resp = await $api<unknown | Envelope<unknown>>(`/mail/imap-configs/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: req,
      })
      unwrap(resp)
    },

    async testImapConfig(id: number): Promise<MailTestResultDTO> {
      const resp = await $api<MailTestResultDTO | Envelope<MailTestResultDTO>>(`/mail/imap-configs/${encodeURIComponent(id)}/test`, {
        method: 'POST',
      })
      return unwrap(resp)
    },
  }

  return { mailApi }
}
