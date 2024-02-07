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

import { map } from './voices';
import { PollyEngine } from './engine';
import { PollyVoice } from './voice';
import { VoiceDescriptor } from './voice-descriptor';

/**
 * Defines a voice descriptor to use for synthesizing voices.
 * The descriptor is composed of a voice and a compatible engine
 * to be used for synthesizing the voice.
 * @param voice the voice to use.
 * @param engine the engine to use.
 * @returns the voice descriptor.
 * @throws if the given voice is not supported by the given engine.
 */
export const voice = (voice: PollyVoice, engine: PollyEngine): VoiceDescriptor => {
  // Check if the given voice is supported by the given engine.
  const pollyVoice = map.find((v) => v.Id === voice);

  if (!pollyVoice) {
    throw new Error(`Voice ${voice} is not supported by Amazon Polly.`);
  }
  if (pollyVoice.SupportedEngines.indexOf(engine) === -1) {
    throw new Error(`Engine ${engine} is not supported for voice ${voice}.`);
  }
  return ({ voice, engine });
};

/**
 * @returns the identifier for the neural engine.
 */
export const neural = (voiceName: PollyVoice): VoiceDescriptor => {
  return (voice(voiceName, 'neural'));
};

/**
 * @returns the identifier for the standard engine.
 */
export const standard = (voiceName: PollyVoice): VoiceDescriptor => {
  return (voice(voiceName, 'standard'));
};
