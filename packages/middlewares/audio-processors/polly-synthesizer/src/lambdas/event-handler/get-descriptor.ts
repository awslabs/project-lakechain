/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CloudEvent } from '@project-lakechain/sdk';
import { map } from '../../definitions/voices.js';
import { VoiceDescriptor } from '../../definitions/voice-descriptor.js';
import { PollyVoice } from '../../definitions/voice.js';

/**
 * The language override.
 */
const LANGUAGE_OVERRIDE = process.env.LANGUAGE_OVERRIDE ?? '';

/**
 * A mapping between languages and voices.
 */
const USER_DEFINED_VOICE_MAPPING: { [key:string]: VoiceDescriptor[] } = JSON.parse(
  process.env.VOICE_MAPPING ?? '{}'
);

/**
 * The default voice descriptor to use.
 */
const DEFAULT_VOICE: VoiceDescriptor = { voice: 'Matthew', engine: 'neural' };

/**
 * Group an array of elements by a given key.
 * @param arr the array to group.
 * @param key the key to group by.
 * @returns a record mapping the given key to the
 * elements of the array.
 */
const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
  arr.reduce((groups, item) => {
    (groups[key(item)] ||= []).push(item);
    return groups;
  }, {} as Record<K, T[]>
);

/**
 * A mapping between languages and voices.
 */
const VOICE_MAP = groupBy(map, (voice) => voice['ISO-639-1']);

/**
 * Pick a random element from the given array.
 * @param array the array to pick from.
 * @returns a random element from the given array.
 */
export const randomPick = <T>(array: T[]): T => {
  if (array.length === 0) {
    throw new Error('Cannot pick from an empty array.');
  }
  return (array[Math.floor(Math.random() * array.length)]);
};

/**
 * Get the language of the source document.
 * @param event the event to process.
 * @returns the language of the source document if
 * found, an undefined value otherwise.
 */
export const getSourceLanguage = (event: CloudEvent): string | undefined => {
  const metadata = event.data().metadata();

  // If a language override is specified, we use it.
  if (LANGUAGE_OVERRIDE && LANGUAGE_OVERRIDE !== '') {
    return (LANGUAGE_OVERRIDE);
  }

  // Otherwise, we try to infer the language of the source
  // document from its metadata.
  if (metadata.language) {
    return (metadata.language);
  }

  return (undefined);
};

/**
 * Attempts to find a voice descriptor from the user-defined
 * mapping, for the given language.
 * @param language the language to find a voice descriptor for.
 * @returns a voice descriptor if found, an undefined value
 * otherwise.
 */
export const findDescriptorFromUserMapping = (
  language: string | undefined
): VoiceDescriptor | undefined => {
  if (language) {
    if (USER_DEFINED_VOICE_MAPPING[language]) {
      return (randomPick(USER_DEFINED_VOICE_MAPPING[language]));
    }
  }
  return (undefined);
};

/**
 * Attempts to find a voice descriptor from the voices
 * supported by Amazon Polly, for the given language.
 * @param language the language to find a voice descriptor for.
 * @returns a voice descriptor if found, an undefined value
 * otherwise.
 */
export const findDescriptorFromPollyVoices = (
  language: string | undefined
): VoiceDescriptor | undefined => {
  if (language) {
    if (VOICE_MAP[language]) {
      const voice = randomPick(VOICE_MAP[language]);
      const engine = voice.SupportedEngines.includes('neural') ? 'neural' : 'standard';
      return ({ voice: voice.Id as PollyVoice, engine });
    }
  }
  return (undefined);
};

/**
 * Attempts to find the most suited voice descriptor to use
 * for a synthesis operation, for the given event.
 * @param event the event to process.
 * @returns a voice descriptor if found, the default voice
 * otherwise.
 */
export const getDescriptor = (event: CloudEvent): VoiceDescriptor => {
  const language = getSourceLanguage(event);
  const descriptor = findDescriptorFromUserMapping(language);

  // If a user-defined descriptor is defined for the given language,
  // we use it.
  if (descriptor) {
    return (descriptor);
  }

  // Otherwise, we try to find a descriptor matching the language
  // from the voices supported by Amazon Polly. If none is found,
  // we use the default voice.
  return (findDescriptorFromPollyVoices(language) ?? DEFAULT_VOICE);
};