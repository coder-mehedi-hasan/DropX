declare module "mjml" {
  export interface MjmlOptions {
    packages?: Record<string, unknown>
    [key: string]: unknown
  }

  export interface MjmlOutput {
    html: string
    errors: string[]
  }

  function mjml2html(input: string, options?: MjmlOptions): Promise<MjmlOutput>
  export default mjml2html
}
