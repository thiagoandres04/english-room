declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    OPENAI_API_KEY?: string;
    SCHOOL_SETUP_HASH?: string;
    SCHOOL_SETUP_EXPIRES?: string;
    BUCKET?: R2Bucket;
  }
}
