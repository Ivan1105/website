import { useHttp, unwrap, type Envelope } from './http'

export interface MailConfigDTO {
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

export interface UpdateMailConfigReq {
  host: string
  port: number
  secure: boolean
  username: string
  password?: string
}

export interface MailTestResultDTO {
  connected: boolean
}

export const useMailApi = () => {
  const { $api } = useHttp()

  const mailApi = {
    async getEndpoints(): Promise<MailEndpointDTO[]> {
      const resp = await $api<MailEndpointDTO[] | Envelope<MailEndpointDTO[]>>('/mail/endpoints', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async getConfig(): Promise<MailConfigDTO | null> {
      const resp = await $api<MailConfigDTO | null | Envelope<MailConfigDTO | null>>('/mail/config', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async updateConfig(req: UpdateMailConfigReq): Promise<void> {
      const resp = await $api<unknown | Envelope<unknown>>('/mail/config', {
        method: 'PUT',
        body: req,
      })
      unwrap(resp)
    },

    async testConnection(): Promise<MailTestResultDTO> {
      const resp = await $api<MailTestResultDTO | Envelope<MailTestResultDTO>>('/mail/test', {
        method: 'POST',
      })
      return unwrap(resp)
    },
  }

  return { mailApi }
}
