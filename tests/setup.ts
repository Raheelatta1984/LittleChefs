/**
 * MUST be the first import in every test file: the config module reads these
 * values at import time.
 */
process.env.NODE_ENV = "test";
process.env.PGLITE_DIR = "memory";
process.env.SEED_BUILTINS = "false";
process.env.IMPORT_ALLOW_PRIVATE_HOSTS = "true";
process.env.LLM_API_KEY = "";
process.env.UPLOADS_DIR = "/tmp/chef-universe-test-uploads";

export {};
