export interface sendMailRequest {
  from: string
  to: string | string[]
  subject: string
  template_name: string
  attachment?: [{ filename: string; path?: string; content?: Buffer }]
  payload: object
  baseUrl?: string
  host?: string
}
