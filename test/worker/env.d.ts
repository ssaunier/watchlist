declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
  }
}

declare module '*?raw' {
  const content: string
  export default content
}
