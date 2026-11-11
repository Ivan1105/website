import { useHttp, unwrap, type Envelope } from './http'

export interface AccountInfoDTO {
  user_id: number
  username: string
  nickname: string | null
  email: string | null
  signature: string | null
  avatar: string | null
  banner: string | null
}

export interface UpdateAccountInfoReq {
  nickname?: string
  email?: string
  password?: string
  currentPassword?: string
  signature?: string
  avatar?: string
  banner?: string
}

export interface AiUserProfileDTO {
  userId: number
  nickname: string | null
  cityname: string | null
  timezone: string | null
  birthday: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface UpdateAiUserProfileReq {
  nickname?: string | null
  cityname?: string | null
  timezone?: string | null
  birthday?: string | null
}

export const useAccountApi = () => {
  const { $api } = useHttp()

  const accountApi = {
    async queryAccountInfo(): Promise<AccountInfoDTO | null> {
      const resp = await $api<AccountInfoDTO | null | Envelope<AccountInfoDTO | null>>('/account/queryAccountInfo', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async updateAccountInfo(req: UpdateAccountInfoReq): Promise<AccountInfoDTO> {
      const resp = await $api<AccountInfoDTO | Envelope<AccountInfoDTO>>('/account/updateAccountInfo', {
        method: 'PUT',
        body: req,
      })
      return unwrap(resp)
    },

    async queryAiUserProfile(): Promise<AiUserProfileDTO | null> {
      const resp = await $api<AiUserProfileDTO | null | Envelope<AiUserProfileDTO | null>>('/account/profile', {
        method: 'GET',
      })
      return unwrap(resp)
    },

    async updateAiUserProfile(req: UpdateAiUserProfileReq): Promise<AiUserProfileDTO> {
      const resp = await $api<AiUserProfileDTO | Envelope<AiUserProfileDTO>>('/account/profile', {
        method: 'PUT',
        body: req,
      })
      return unwrap(resp)
    },
  }

  return { accountApi }
}
