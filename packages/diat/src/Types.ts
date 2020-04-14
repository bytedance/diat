import { EventEmitter as Event } from 'events'

export type IPostFunc = (method: string, params: any) => Promise<any>

export interface IComm {
  event: Event
  post: IPostFunc
}

export type IUploadFileFunc = (file: string, gzip?: boolean) => Promise<any>
