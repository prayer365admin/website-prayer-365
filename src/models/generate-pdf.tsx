export interface generatePdfRequest {
  mode: 'DOWNLOAD' | 'VIEW'
  template_name: string
  payload: object
}
