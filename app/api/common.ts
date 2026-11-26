import { useHttp, unwrap, type Envelope } from './http'

export interface UploadImageDTO {
  path: string
}

export type ImageUploadModule = 'icon' | 'banner' | 'qq-images'

export const useCommonApi = () => {
  const { $api } = useHttp()

  const commonApi = {
    async uploadImage(file: Blob, module: ImageUploadModule): Promise<UploadImageDTO> {
      const body = new FormData()
      const filename = module === 'qq-images' && file instanceof File
        ? file.name
        : module === 'icon' ? 'avatar.webp' : 'banner-upload'
      body.append('file', file, filename)
      body.append('module', module)

      const resp = await $api<UploadImageDTO | Envelope<UploadImageDTO>>('/common/uploadImage', {
        method: 'POST',
        body,
      })
      return unwrap(resp)
    },
  }

  return { commonApi }
}
