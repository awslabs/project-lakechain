import {
  TranslationSettings,
  Formality
} from '@aws-sdk/client-translate';

/**
 * Environment variables.
 */
const PROFANITY_REDACTION = process.env.PROFANITY_REDACTION === 'true';
const FORMALITY = process.env.FORMALITY ?? 'NONE';

/**
 * @returns the settings to use for the translation job.
 */
export const getSettings = (): TranslationSettings => {
  const settings: TranslationSettings = {};

  // If profanity redaction is enabled, we set the profanity
  // setting to MASK.
  if (PROFANITY_REDACTION) {
    settings['Profanity'] = 'MASK';
  }

  // If formality is enabled, we set the formality setting
  // to the value of the FORMALITY environment variable.
  if (FORMALITY !== 'NONE') {
    settings['Formality'] = FORMALITY as Formality;
  }

  return (settings);
};
