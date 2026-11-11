export { ApiError, isApiError } from './http'

export { NotificationStreamError, useNotificationApi } from './notifications'
export type {
  NotificationData,
  NotificationInstallationDTO,
  NotificationPingData,
  NotificationSource,
  NotificationStreamHandlers,
  RegisterNotificationInstallationReq,
  UnregisterNotificationInstallationReq,
} from './notifications'

export { useAdminApi } from './admin'
export type { AdminPaginationDTO, AdminUserDTO, QueryUsersDTO, ResetPasswordDTO, UpdateActiveReq } from './admin'

export {
  CONFIDENCE_LEVELS,
  EVENT_STATUSES,
  EVENT_TYPES,
  SONG_SINGERS,
  SONG_STATUSES,
  SOURCE_RELATION_TYPES,
  SOURCE_RELIABILITIES,
  SOURCE_TYPES,
  TOUR_STATUSES,
  useConcertAdminApi,
} from './concert-admin'
export type {
  BaseConcertDTO,
  CallbookDTO,
  CallbookPageDTO,
  CallbookPatch,
  ConcertPageDTO,
  ConcertPaginationDTO,
  ConcertResource,
  Confidence,
  EventDTO,
  EventInput,
  EventStatus,
  EventType,
  ListQuery,
  SetlistItemDTO,
  SetlistItemInput,
  SongDTO,
  SongInput,
  SongSinger,
  SongStatus,
  SourceDTO,
  SourceInput,
  SourceRelationType,
  SourceReliability,
  SourceType,
  TourDTO,
  TourInput,
  TourSourceDTO,
  TourSourceInput,
  TourStatus,
  VenueDTO,
  VenueInput,
} from './concert-admin'

export { useChatApi } from './chat'
export type {
  ActiveRunDTO,
  ActiveRunUserMessageDTO,
  ChatRunDoneEvent,
  ChatRunErrorEvent,
  ChatRunMessageStartEvent,
  ChatRunSourceEvent,
  ChatRunStreamEvent,
  ChatRunTextEvent,
  ChatRunToolCallEvent,
  ChatRunToolResultEvent,
  ConversationDTO,
  CreateThreadDTO,
  MessageDTO,
  MessagePaginationDTO,
  MessageSourceDTO,
  QueryMessagesDTO,
  SendMessageDTO,
  SendMessageReq,
  UpdateJournalReq,
  UpdateProactiveReq,
} from './chat'

export { useCommonApi } from './common'
export type { ImageUploadModule, UploadImageDTO } from './common'

export { useMailApi } from './mail'
export type {
  CreateImapConfigReq,
  ImapConfigDTO,
  ImapSubscriptionData,
  ImapSubscriptionStatus,
  MailAccountDTO,
  MailAccountKind,
  MailAccountProvider,
  MailAccountStatus,
  MailEndpointDTO,
  MailTestResultDTO,
  OutlookSubscriptionData,
  OutlookSubscriptionStatus,
  SetImapSubscriptionInput,
  SetOutlookSubscriptionInput,
  UpdateImapConfigReq,
} from './mail'

export { useOAuthApi } from './oauth'
export type { OAuthAuthorizeDTO, OAuthServiceDTO } from './oauth'

export { useAccountApi } from './account'
export type { AccountInfoDTO, AiUserProfileDTO, UpdateAccountInfoReq, UpdateAiUserProfileReq } from './account'

export { useUserApi } from './user'
export type { LoginReq, LoginResp, UserInfoDTO, UserRole } from './user'
