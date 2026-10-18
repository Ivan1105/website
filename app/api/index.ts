export { ApiError, isApiError } from './http'

export { useAdminApi } from './admin'
export type { AdminPaginationDTO, AdminUserDTO, QueryUsersDTO, ResetPasswordDTO, UpdateActiveReq } from './admin'

export { useChatApi } from './chat'
export type {
  ActiveRunDTO,
  ActiveRunUserMessageDTO,
  ChatRunDoneEvent,
  ChatRunErrorEvent,
  ChatRunMessageStartEvent,
  ChatRunStreamEvent,
  ChatRunTextEvent,
  ChatRunToolCallEvent,
  ChatRunToolResultEvent,
  ConversationDTO,
  CreateThreadDTO,
  MessageDTO,
  MessagePaginationDTO,
  QueryMessagesDTO,
  SendMessageDTO,
  SendMessageReq,
  UpdateJournalReq,
  UpdateProactiveReq,
} from './chat'

export { useCommonApi } from './common'
export type { ImageUploadModule, UploadImageDTO } from './common'

export { useMailApi } from './mail'
export type { MailConfigDTO, MailEndpointDTO, MailTestResultDTO, UpdateMailConfigReq } from './mail'

export { useOAuthApi } from './oauth'
export type { OAuthAuthorizeDTO, OAuthServiceDTO } from './oauth'

export { useAccountApi } from './account'
export type { AccountInfoDTO, UpdateAccountInfoReq } from './account'

export { useUserApi } from './user'
export type { LoginReq, LoginResp, UserInfoDTO, UserRole } from './user'
