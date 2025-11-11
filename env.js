/* eslint-env node */

/*

 * Env file to load and validate env variables

 * Be cautious; this file should not be imported into your source folder.

 * We split the env variables into two parts:

 * 1. Client variables: These variables are used in the client-side code (src folder).

 * 2. Build-time variables: These variables are used in the build process (app.config.ts file).

 * Import this file into the `app.config.ts` file to use environment variables during the build process. The client variables can then be passed to the client-side using the extra field in the `app.config.ts` file.

 * To access the client environment variables in your `src` folder, you can import them from `@env`. For example: `import Env from '@env'`.

 */

/**

 * 1st part: Import packages and Load your env variables

 * we use dotenv to load the correct variables from the .env file based on the APP_ENV variable (default is development)

 * APP_ENV is passed as an inline variable while executing the command, for example: APP_ENV=staging pnpm build:android

 */

const path = require('path');
const z = require('zod');
// Use CommonJS __dirname directly and resolve package.json from it
// eslint-disable-next-line no-undef
const packageJSON = require(path.join(__dirname, 'package.json'));

const APP_ENV = process.env.APP_ENV ?? 'development';

/**
 * Reads environment variables from the provided keys, returning the first defined value.
 * Empty strings are treated as valid values (not undefined).
 *
 * @param {...string} keys - Environment variable keys to check in order
 * @returns {string|undefined} The first defined value, or undefined if none found
 */
const readEnv = (...keys) => {
  for (const key of keys) {
    const value = Reflect.get(process.env, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

// eslint-disable-next-line no-undef
const envPath = path.resolve(__dirname, `.env.${APP_ENV}`);

require('dotenv').config({
  path: envPath,
});

// Optionally load local overrides (never committed). This can override values

// from .env.{APP_ENV} to keep secrets out of VCS while preserving dev defaults.

// eslint-disable-next-line no-undef
const localEnvPath = path.resolve(__dirname, `.env.local`);

require('dotenv').config({ path: localEnvPath, override: true });

/**

 * 2nd part: Define some static variables for the app

 * Such as: bundle id, package name, app name.

 *

 * You can add them to the .env file but we think it's better to keep them here as as we use prefix to generate this values based on the APP_ENV

 * for example: if the APP_ENV is staging, the bundle id will be com.growbro.staging

 */

// TODO: Replace these values with your own

const BUNDLE_ID = 'com.growbro'; // ios bundle id

const PACKAGE = 'com.growbro'; // android package name

const NAME = 'GrowBro'; // app name

const EXPO_ACCOUNT_OWNER = 'jan_100'; // expo account owner

const EAS_PROJECT_ID = '0ce1e1fc-7b61-4a2f-ae2b-790c097ced82'; // eas project id

const SCHEME = 'growbro'; // app scheme

/**

 * We declare a function withEnvSuffix that will add a suffix to the variable name based on the APP_ENV

 * Add a suffix to variable env based on APP_ENV

 * @param {string} name

 * @returns  {string}

 */

const withEnvSuffix = (name) => {
  return APP_ENV === 'production' ? name : `${name}.${APP_ENV}`;
};

/**

 * 2nd part: Define your env variables schema

 * we use zod to define our env variables schema

 *

 * we split the env variables into two parts:

 *    1. client: These variables are used in the client-side code (`src` folder).

 *    2. buildTime: These variables are used in the build process (app.config.ts file). You can think of them as server-side variables.

 *

 * Main rules:

 *    1. If you need your variable on the client-side, you should add it to the client schema; otherwise, you should add it to the buildTime schema.

 *    2. Whenever you want to add a new variable, you should add it to the correct schema based on the previous rule, then you should add it to the corresponding object (_clientEnv or _buildTimeEnv).

 *

 * Note: `z.string()` means that the variable exists and can be an empty string, but not `undefined`.

 * If you want to make the variable required, you should use `z.string().min(1)` instead.

 * Read more about zod here: https://zod.dev/?id=strings

 *

 */

const client = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),

  NAME: z.string(),

  SCHEME: z.string(),

  BUNDLE_ID: z.string(),

  PACKAGE: z.string(),

  VERSION: z.string(),

  // ADD YOUR CLIENT ENV VARS HERE

  API_URL: z.string(),

  VAR_NUMBER: z.number(),

  VAR_BOOL: z.boolean(),

  // Strains API Configuration

  STRAINS_API_URL: z.string().url().optional(),

  STRAINS_API_KEY: z.string().optional(),

  STRAINS_API_HOST: z.string().optional(),

  STRAINS_USE_PROXY: z.boolean().optional(),

  // Feature Flags

  FEATURE_STRAINS_ENABLED: z.boolean().optional(),

  FEATURE_STRAINS_FAVORITES_SYNC: z.boolean().optional(),

  FEATURE_STRAINS_OFFLINE_CACHE: z.boolean().optional(),

  FEATURE_AI_ADJUSTMENTS_ENABLED: z.boolean().optional(),

  FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS: z.number().optional(),

  FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE: z.number().optional(),

  ENABLE_SORTABLES_CALENDAR: z.boolean().optional(),

  // Supabase Configuration

  SUPABASE_URL: z.string().url(),

  SUPABASE_ANON_KEY: z.string().min(1),

  GOOGLE_WEB_CLIENT_ID: z.string().min(1),

  GOOGLE_IOS_CLIENT_ID: z.string().optional(),

  // Account deletion portal

  ACCOUNT_DELETION_URL: z.string().url().optional(),

  // Sentry Configuration (Client)

  SENTRY_DSN: z.string().optional(),

  SENTRY_SEND_DEFAULT_PII: z.boolean().optional(),

  SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.number().min(0).max(1).optional(),

  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z.number().min(0).max(1).optional(),

  SENTRY_ENABLE_REPLAY: z.boolean().optional(),

  SENTRY_ORG: z.string().optional(),

  SENTRY_PROJECT: z.string().optional(),

  // App Access Reviewer Credentials

  APP_ACCESS_REVIEWER_EMAIL: z.string().optional(),

  APP_ACCESS_REVIEWER_PASSWORD: z.string().optional(),

  EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL: z.string().optional(),

  EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD: z.string().optional(),

  // DSA Transparency Database Configuration

  DSA_TRANSPARENCY_DB_URL: z.string().url().optional(),

  DSA_TRANSPARENCY_DB_API_KEY: z.string().optional(),

  EXPO_PUBLIC_DSA_TRANSPARENCY_DB_URL: z.string().url().optional(),

  EXPO_PUBLIC_DSA_TRANSPARENCY_DB_API_KEY: z.string().optional(),

  // PII Scrubbing Configuration

  PII_SCRUBBING_SALT: z.string().optional(),

  PII_SALT_VERSION: z.string().optional(),

  EXPO_PUBLIC_PII_SCRUBBING_SALT: z.string().optional(),

  EXPO_PUBLIC_PII_SALT_VERSION: z.string().optional(),

  // Legal/Compliance Contact Information

  LEGAL_ENTITY_ADDRESS: z.string().optional(),

  DPO_EMAIL: z.string().email().optional(),

  DPO_NAME: z.string().optional(),

  EU_REPRESENTATIVE_ADDRESS: z.string().optional(),

  EXPO_PUBLIC_LEGAL_ENTITY_ADDRESS: z.string().optional(),

  EXPO_PUBLIC_DPO_EMAIL: z.string().email().optional(),

  EXPO_PUBLIC_DPO_NAME: z.string().optional(),

  EXPO_PUBLIC_EU_REPRESENTATIVE_ADDRESS: z.string().optional(),

  // Security Feature Flags

  FEATURE_SECURITY_ENCRYPTION: z.union([z.string(), z.boolean()]).optional(),

  FEATURE_SECURITY_INTEGRITY_DETECTION: z
    .union([z.string(), z.boolean()])
    .optional(),

  FEATURE_SECURITY_ATTESTATION: z.union([z.string(), z.boolean()]).optional(),

  FEATURE_SECURITY_CERTIFICATE_PINNING: z
    .union([z.string(), z.boolean()])
    .optional(),

  FEATURE_SECURITY_BLOCK_ON_COMPROMISE: z
    .union([z.string(), z.boolean()])
    .optional(),

  FEATURE_SECURITY_THREAT_MONITORING: z
    .union([z.string(), z.boolean()])
    .optional(),

  FEATURE_SECURITY_SENTRY_SAMPLING_RATE: z
    .union([z.string(), z.number()])
    .optional(),

  FEATURE_SECURITY_VULNERABILITY_SCANNING: z
    .union([z.string(), z.boolean()])
    .optional(),

  FEATURE_SECURITY_AUTO_ISSUE_CREATION: z
    .union([z.string(), z.boolean()])
    .optional(),

  FEATURE_SECURITY_BYPASS_PINNING: z
    .union([z.string(), z.boolean()])
    .optional(),

  SECURITY_PIN_DOMAINS: z.string().optional(),
  SECURITY_PIN_HASHES: z.string().optional(),
  EXPO_PUBLIC_SECURITY_PIN_DOMAINS: z.string().optional(),
  EXPO_PUBLIC_SECURITY_PIN_HASHES: z.string().optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_ENCRYPTION: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_INTEGRITY_DETECTION: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_ATTESTATION: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_CERTIFICATE_PINNING: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_BLOCK_ON_COMPROMISE: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_THREAT_MONITORING: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_SENTRY_SAMPLING_RATE: z
    .union([z.string(), z.number()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_VULNERABILITY_SCANNING: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_AUTO_ISSUE_CREATION: z
    .union([z.string(), z.boolean()])
    .optional(),

  EXPO_PUBLIC_FEATURE_SECURITY_BYPASS_PINNING: z
    .union([z.string(), z.boolean()])
    .optional(),
});

const buildTime = z.object({
  EXPO_ACCOUNT_OWNER: z.string(),

  EAS_PROJECT_ID: z.string(),

  // ADD YOUR BUILD TIME ENV VARS HERE

  SECRET_KEY: z.string(),

  // Email hashing salt for audit log privacy
  EMAIL_HASH_SALT: z.string().min(1),

  CODE_SIGNING_CERT_PATH: z.string().optional(),
  CODE_SIGNING_KEY_ID: z.string().optional(),
  CODE_SIGNING_ALG: z.string().optional(),
});

/**

 * @type {Record<keyof z.infer<typeof client> , unknown>}

 */

const apiUrl = readEnv('API_URL', 'EXPO_PUBLIC_API_URL');
const varNumberRaw = readEnv('VAR_NUMBER', 'EXPO_PUBLIC_VAR_NUMBER');
const varBoolRaw = readEnv('VAR_BOOL', 'EXPO_PUBLIC_VAR_BOOL');
const strainsApiUrl = readEnv('STRAINS_API_URL', 'EXPO_PUBLIC_STRAINS_API_URL');
const strainsApiKey = readEnv('STRAINS_API_KEY', 'EXPO_PUBLIC_STRAINS_API_KEY');
const strainsApiHost = readEnv(
  'STRAINS_API_HOST',
  'EXPO_PUBLIC_STRAINS_API_HOST'
);
const strainsUseProxyRaw = (() => {
  const v = readEnv('STRAINS_USE_PROXY', 'EXPO_PUBLIC_STRAINS_USE_PROXY');
  if (v === 'true') return true;
  if (v === undefined) return APP_ENV === 'development';
  return false;
})();
const featureStrainsEnabledRaw = readEnv(
  'FEATURE_STRAINS_ENABLED',
  'EXPO_PUBLIC_FEATURE_STRAINS_ENABLED'
);
const featureStrainsFavoritesSyncRaw = readEnv(
  'FEATURE_STRAINS_FAVORITES_SYNC',
  'EXPO_PUBLIC_FEATURE_STRAINS_FAVORITES_SYNC'
);
const featureStrainsOfflineCacheRaw = readEnv(
  'FEATURE_STRAINS_OFFLINE_CACHE',
  'EXPO_PUBLIC_FEATURE_STRAINS_OFFLINE_CACHE'
);
const featureAiAdjustmentsEnabledRaw = readEnv(
  'FEATURE_AI_ADJUSTMENTS_ENABLED',
  'EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_ENABLED'
);
const featureAiAdjustmentsMinSkippedTasksRaw = readEnv(
  'FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS',
  'EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS'
);
const featureAiAdjustmentsMinConfidenceRaw = readEnv(
  'FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE',
  'EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE'
);
const enableSortablesCalendarRaw = readEnv(
  'ENABLE_SORTABLES_CALENDAR',
  'EXPO_PUBLIC_ENABLE_SORTABLES_CALENDAR'
);
const supabaseUrl = readEnv('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readEnv(
  'SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
);
const googleWebClientId = readEnv(
  'GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
);
const googleIosClientId = readEnv(
  'GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
);
const accountDeletionUrl = readEnv(
  'ACCOUNT_DELETION_URL',
  'EXPO_PUBLIC_ACCOUNT_DELETION_URL'
);
const sentryDsn = readEnv('SENTRY_DSN', 'EXPO_PUBLIC_SENTRY_DSN');
const sentrySendDefaultPiiRaw = readEnv(
  'SENTRY_SEND_DEFAULT_PII',
  'EXPO_PUBLIC_SENTRY_SEND_DEFAULT_PII'
);
const sentryReplaysSessionSampleRateRaw = readEnv(
  'SENTRY_REPLAYS_SESSION_SAMPLE_RATE',
  'EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE'
);
const sentryReplaysOnErrorSampleRateRaw = readEnv(
  'SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE',
  'EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE'
);
const sentryEnableReplayRaw = readEnv(
  'SENTRY_ENABLE_REPLAY',
  'EXPO_PUBLIC_SENTRY_ENABLE_REPLAY'
);
const sentryOrg = readEnv('SENTRY_ORG', 'EXPO_PUBLIC_SENTRY_ORG');
const sentryProject = readEnv('SENTRY_PROJECT', 'EXPO_PUBLIC_SENTRY_PROJECT');
const appAccessReviewerEmail = readEnv(
  'APP_ACCESS_REVIEWER_EMAIL',
  'EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL'
);
const appAccessReviewerPassword = readEnv(
  'APP_ACCESS_REVIEWER_PASSWORD',
  'EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD'
);
const dsaTransparencyDbUrl = readEnv(
  'DSA_TRANSPARENCY_DB_URL',
  'EXPO_PUBLIC_DSA_TRANSPARENCY_DB_URL'
);
const dsaTransparencyDbApiKey = readEnv(
  'DSA_TRANSPARENCY_DB_API_KEY',
  'EXPO_PUBLIC_DSA_TRANSPARENCY_DB_API_KEY'
);
const piiScrubbingSalt = readEnv(
  'PII_SCRUBBING_SALT',
  'EXPO_PUBLIC_PII_SCRUBBING_SALT'
);
const piiSaltVersion = readEnv(
  'PII_SALT_VERSION',
  'EXPO_PUBLIC_PII_SALT_VERSION'
);
const legalEntityAddress = readEnv(
  'LEGAL_ENTITY_ADDRESS',
  'EXPO_PUBLIC_LEGAL_ENTITY_ADDRESS'
);
const featureSecurityEncryptionRaw = readEnv(
  'FEATURE_SECURITY_ENCRYPTION',
  'EXPO_PUBLIC_FEATURE_SECURITY_ENCRYPTION'
);
const featureSecurityIntegrityDetectionRaw = readEnv(
  'FEATURE_SECURITY_INTEGRITY_DETECTION',
  'EXPO_PUBLIC_FEATURE_SECURITY_INTEGRITY_DETECTION'
);
const featureSecurityAttestationRaw = readEnv(
  'FEATURE_SECURITY_ATTESTATION',
  'EXPO_PUBLIC_FEATURE_SECURITY_ATTESTATION'
);
const featureSecurityCertificatePinningRaw = readEnv(
  'FEATURE_SECURITY_CERTIFICATE_PINNING',
  'EXPO_PUBLIC_FEATURE_SECURITY_CERTIFICATE_PINNING'
);
const featureSecurityBlockOnCompromiseRaw = readEnv(
  'FEATURE_SECURITY_BLOCK_ON_COMPROMISE',
  'EXPO_PUBLIC_FEATURE_SECURITY_BLOCK_ON_COMPROMISE'
);
const featureSecurityThreatMonitoringRaw = readEnv(
  'FEATURE_SECURITY_THREAT_MONITORING',
  'EXPO_PUBLIC_FEATURE_SECURITY_THREAT_MONITORING'
);
const featureSecuritySentrySamplingRateRaw = readEnv(
  'FEATURE_SECURITY_SENTRY_SAMPLING_RATE',
  'EXPO_PUBLIC_FEATURE_SECURITY_SENTRY_SAMPLING_RATE'
);
const featureSecurityVulnerabilityScanningRaw = readEnv(
  'FEATURE_SECURITY_VULNERABILITY_SCANNING',
  'EXPO_PUBLIC_FEATURE_SECURITY_VULNERABILITY_SCANNING'
);
const featureSecurityAutoIssueCreationRaw = readEnv(
  'FEATURE_SECURITY_AUTO_ISSUE_CREATION',
  'EXPO_PUBLIC_FEATURE_SECURITY_AUTO_ISSUE_CREATION'
);
const featureSecurityBypassPinningRaw = readEnv(
  'FEATURE_SECURITY_BYPASS_PINNING',
  'EXPO_PUBLIC_FEATURE_SECURITY_BYPASS_PINNING'
);
const securityPinnedDomainsRaw = readEnv(
  'SECURITY_PIN_DOMAINS',
  'EXPO_PUBLIC_SECURITY_PIN_DOMAINS'
);
const securityPinnedHashesRaw = readEnv(
  'SECURITY_PIN_HASHES',
  'EXPO_PUBLIC_SECURITY_PIN_HASHES'
);
const codeSigningCertPath = readEnv('CODE_SIGNING_CERT_PATH');
const codeSigningKeyId = readEnv('CODE_SIGNING_KEY_ID');
const codeSigningAlg = readEnv('CODE_SIGNING_ALG');
const dpoEmail = readEnv('DPO_EMAIL', 'EXPO_PUBLIC_DPO_EMAIL');
const dpoName = readEnv('DPO_NAME', 'EXPO_PUBLIC_DPO_NAME');
const euRepresentativeAddress = readEnv(
  'EU_REPRESENTATIVE_ADDRESS',
  'EXPO_PUBLIC_EU_REPRESENTATIVE_ADDRESS'
);

const scheme = readEnv('SCHEME', 'EXPO_PUBLIC_SCHEME') || SCHEME;

const _clientEnv = {
  APP_ENV,

  NAME: NAME,

  SCHEME: scheme,

  BUNDLE_ID: withEnvSuffix(BUNDLE_ID),

  PACKAGE: withEnvSuffix(PACKAGE),

  VERSION: packageJSON.version,

  // ADD YOUR ENV VARS HERE TOO

  API_URL: apiUrl,

  VAR_NUMBER: varNumberRaw !== undefined ? Number(varNumberRaw) : undefined,

  VAR_BOOL: varBoolRaw === 'true',

  // Strains API Configuration

  STRAINS_API_URL: strainsApiUrl,

  STRAINS_API_KEY: strainsApiKey,

  STRAINS_API_HOST: strainsApiHost,

  STRAINS_USE_PROXY: strainsUseProxyRaw,

  // Feature Flags

  FEATURE_STRAINS_ENABLED:
    featureStrainsEnabledRaw !== undefined
      ? featureStrainsEnabledRaw === 'true'
      : APP_ENV === 'development',

  FEATURE_STRAINS_FAVORITES_SYNC:
    featureStrainsFavoritesSyncRaw !== undefined
      ? featureStrainsFavoritesSyncRaw === 'true'
      : APP_ENV === 'development',

  FEATURE_STRAINS_OFFLINE_CACHE:
    featureStrainsOfflineCacheRaw !== undefined
      ? featureStrainsOfflineCacheRaw === 'true'
      : APP_ENV === 'development',

  FEATURE_AI_ADJUSTMENTS_ENABLED:
    featureAiAdjustmentsEnabledRaw !== undefined
      ? featureAiAdjustmentsEnabledRaw === 'true'
      : false,

  FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS:
    featureAiAdjustmentsMinSkippedTasksRaw !== undefined
      ? Number(featureAiAdjustmentsMinSkippedTasksRaw)
      : 2,

  FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE:
    featureAiAdjustmentsMinConfidenceRaw !== undefined
      ? Number(featureAiAdjustmentsMinConfidenceRaw)
      : 0.7,

  ENABLE_SORTABLES_CALENDAR:
    enableSortablesCalendarRaw !== undefined
      ? enableSortablesCalendarRaw === 'true'
      : false,

  // Supabase Configuration

  SUPABASE_URL: supabaseUrl,

  SUPABASE_ANON_KEY: supabaseAnonKey,

  GOOGLE_WEB_CLIENT_ID: googleWebClientId,

  GOOGLE_IOS_CLIENT_ID: googleIosClientId,

  // Account deletion portal

  ACCOUNT_DELETION_URL: accountDeletionUrl,

  // Sentry Configuration (Client)

  SENTRY_DSN: sentryDsn,

  SENTRY_SEND_DEFAULT_PII:
    sentrySendDefaultPiiRaw !== undefined
      ? sentrySendDefaultPiiRaw === 'true'
      : undefined,

  SENTRY_REPLAYS_SESSION_SAMPLE_RATE:
    sentryReplaysSessionSampleRateRaw !== undefined
      ? Number(sentryReplaysSessionSampleRateRaw)
      : undefined,

  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE:
    sentryReplaysOnErrorSampleRateRaw !== undefined
      ? Number(sentryReplaysOnErrorSampleRateRaw)
      : undefined,

  SENTRY_ENABLE_REPLAY:
    sentryEnableReplayRaw !== undefined
      ? sentryEnableReplayRaw === 'true'
      : undefined,

  SENTRY_ORG: sentryOrg,

  SENTRY_PROJECT: sentryProject,

  // App Access Reviewer Credentials

  APP_ACCESS_REVIEWER_EMAIL: appAccessReviewerEmail,

  APP_ACCESS_REVIEWER_PASSWORD: appAccessReviewerPassword,

  // DSA Transparency Database Configuration

  DSA_TRANSPARENCY_DB_URL: dsaTransparencyDbUrl,

  DSA_TRANSPARENCY_DB_API_KEY: dsaTransparencyDbApiKey,

  // PII Scrubbing Configuration

  PII_SCRUBBING_SALT: piiScrubbingSalt,

  PII_SALT_VERSION: piiSaltVersion,

  // Legal/Compliance Contact Information

  LEGAL_ENTITY_ADDRESS: legalEntityAddress,

  DPO_EMAIL: dpoEmail,

  DPO_NAME: dpoName || 'Jan-Peter Blohm',

  EU_REPRESENTATIVE_ADDRESS: euRepresentativeAddress,

  // Security Feature Flags

  FEATURE_SECURITY_ENCRYPTION:
    featureSecurityEncryptionRaw !== undefined
      ? featureSecurityEncryptionRaw === 'true'
      : undefined,

  FEATURE_SECURITY_INTEGRITY_DETECTION:
    featureSecurityIntegrityDetectionRaw !== undefined
      ? featureSecurityIntegrityDetectionRaw === 'true'
      : undefined,

  FEATURE_SECURITY_ATTESTATION:
    featureSecurityAttestationRaw !== undefined
      ? featureSecurityAttestationRaw === 'true'
      : undefined,

  FEATURE_SECURITY_CERTIFICATE_PINNING:
    featureSecurityCertificatePinningRaw !== undefined
      ? featureSecurityCertificatePinningRaw === 'true'
      : undefined,

  FEATURE_SECURITY_BLOCK_ON_COMPROMISE:
    featureSecurityBlockOnCompromiseRaw !== undefined
      ? featureSecurityBlockOnCompromiseRaw === 'true'
      : undefined,

  FEATURE_SECURITY_THREAT_MONITORING:
    featureSecurityThreatMonitoringRaw !== undefined
      ? featureSecurityThreatMonitoringRaw === 'true'
      : undefined,

  FEATURE_SECURITY_SENTRY_SAMPLING_RATE:
    featureSecuritySentrySamplingRateRaw !== undefined
      ? Number(featureSecuritySentrySamplingRateRaw)
      : undefined,

  FEATURE_SECURITY_VULNERABILITY_SCANNING:
    featureSecurityVulnerabilityScanningRaw !== undefined
      ? featureSecurityVulnerabilityScanningRaw === 'true'
      : undefined,

  FEATURE_SECURITY_AUTO_ISSUE_CREATION:
    featureSecurityAutoIssueCreationRaw !== undefined
      ? featureSecurityAutoIssueCreationRaw === 'true'
      : undefined,

  FEATURE_SECURITY_BYPASS_PINNING:
    featureSecurityBypassPinningRaw !== undefined
      ? featureSecurityBypassPinningRaw === 'true'
      : undefined,

  SECURITY_PIN_DOMAINS: securityPinnedDomainsRaw,
  SECURITY_PIN_HASHES: securityPinnedHashesRaw,
};

/**

 * @type {Record<keyof z.infer<typeof buildTime> , unknown>}

 */

const _buildTimeEnv = {
  EXPO_ACCOUNT_OWNER,

  EAS_PROJECT_ID,

  // ADD YOUR ENV VARS HERE TOO

  SECRET_KEY: process.env.SECRET_KEY,

  // Email hashing salt for audit log privacy
  EMAIL_HASH_SALT: process.env.EMAIL_HASH_SALT,

  CODE_SIGNING_CERT_PATH: codeSigningCertPath,
  CODE_SIGNING_KEY_ID: codeSigningKeyId,
  CODE_SIGNING_ALG: codeSigningAlg,
};

/**

 * 3rd part: Merge and Validate your env variables

 * We use zod to validate our env variables based on the schema we defined above

 * If the validation fails we throw an error and log the error to the console with a detailed message about missed variables

 * If the validation passes we export the merged and parsed env variables to be used in the app.config.ts file as well as a ClientEnv object to be used in the client-side code

 **/

const _env = {
  ..._clientEnv,

  ..._buildTimeEnv,
};

const merged = buildTime.merge(client);

const parsed = merged.safeParse(_env);

if (parsed.success === false) {
  console.error(
    '❌ Invalid environment variables:',

    parsed.error.flatten().fieldErrors,

    `\n❌ Missing variables in .env.${APP_ENV} file, Make sure all required variables are defined in the .env.${APP_ENV} file.`,

    `\n💡 Tip: If you recently updated the .env.${APP_ENV} file and the error still persists, try restarting the server with the -c flag to clear the cache.`
  );

  throw new Error(
    'Invalid environment variables, Check terminal for more details '
  );
}

const Env = parsed.data;

const ClientEnv = client.parse(_clientEnv);

module.exports = {
  Env,

  ClientEnv,

  withEnvSuffix,
};
