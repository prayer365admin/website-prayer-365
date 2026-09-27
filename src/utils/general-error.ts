export class GeneralError extends Error {
  error: string
  error_code: string
  details: string
  code: number

  constructor({
    code,
    details,
    error_code,
    error,
  }: {
    code: number
    details: string
    error: string
    error_code: string
  }) {
    super()
    this.code = code
    this.details = details
    this.error = error
    this.error_code = error_code
  }
}
