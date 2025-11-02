declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY: string
    MODEL_ID?: string
    SITE_URL?: string
  }
}
