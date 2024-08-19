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

import { z } from 'zod';

/**
 * The voice settings schema.
 */
const VoiceSettingsPropsSchema = z.object({

  /**
   * The stability slider determines how stable the voice is and the randomness between each generation.
   * Lowering this slider introduces a broader emotional range for the voice.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   */
  stability: z
    .number()
    .min(0)
    .max(1),
  
  /**
   * The similarity slider dictates how closely the AI should adhere to the original voice when
   * attempting to replicate it.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   */
  similarity_boost: z
    .number()
    .min(0)
    .max(1),
  
  /**
   * With the introduction of the newer models, we also added a style exaggeration setting.
   * This setting attempts to amplify the style of the original speaker.
   * In general, we recommend keeping this setting at 0 at all times.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   */
  style: z
    .number()
    .min(0)
    .max(1),

  /**
   * This is another setting that was introduced in the new models.
   * The setting itself is quite self-explanatory – it boosts the similarity to the original speaker.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   */
  use_speaker_boost: z.boolean()
});

// The type of the `VoiceSettingsProps` schema.
export type VoiceSettingsProps = z.infer<typeof VoiceSettingsPropsSchema>;

/**
 * The voice settings builder.
 */
export class VoiceSettingsBuilder {

  /**
   * The background removal task properties.
   */
  private props: Partial<VoiceSettingsProps> = {};

  /**
   * Sets the stability slider.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   * @param stability the stability slider.
   * @returns the builder instance.
   */
  public withStability(stability: number) {
    this.props.stability = stability;
    return (this);
  }

  /**
   * Sets the similarity slider.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   * @param similarity the similarity slider.
   * @returns the builder instance.
   */
  public withSimilarityBoost(similarity: number) {
    this.props.similarity_boost = similarity;
    return (this);
  }

  /**
   * Sets the style slider.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   * @param style the style slider.
   * @returns the builder instance.
   */
  public withStyle(style: number) {
    this.props.style = style;
    return (this);
  }

  /**
   * Sets whether to enable speaker boost.
   * @see https://elevenlabs.io/docs/speech-synthesis/voice-settings
   * @param useSpeakerBoost whether to enable speaker boost.
   * @returns the builder instance.
   */
  public withSpeakerBoost(useSpeakerBoost: boolean) {
    this.props.use_speaker_boost = useSpeakerBoost;
    return (this);
  }

  /**
   * @returns a new instance of the `VoiceSettings`
   * constructed with the given parameters.
   */
  public build(): VoiceSettings {
    return (VoiceSettings.from(this.props));
  }
}

/**
 * The voice settings class.
 */
export class VoiceSettings {

  /**
   * The `VoiceSettings` Builder.
   */
  public static readonly Builder = VoiceSettingsBuilder;

  /**
   * Creates a new instance of the `VoiceSettings` class.
   * @param props the task properties.
   */
  constructor(public props: VoiceSettingsProps) {}

  /**
   * @returns the stability slider.
   */
  public getStability() {
    return (this.props.stability);
  }

  /**
   * @returns the similarity slider.
   */
  public getSimilarityBoost() {
    return (this.props.similarity_boost);
  }

  /**
   * @returns the style slider.
   */
  public getStyle() {
    return (this.props.style);
  }

  /**
   * @returns whether to enable speaker boost.
   */
  public getSpeakerBoost() {
    return (this.props.use_speaker_boost);
  }

  /**
   * Creates a new instance of the `VoiceSettings` class.
   * @param props the task properties.
   * @returns a new instance of the `VoiceSettings` class.
   */
  public static from(props: any) {
    return (new VoiceSettings(VoiceSettingsPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
