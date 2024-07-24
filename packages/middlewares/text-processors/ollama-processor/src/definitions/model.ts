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

export interface OllamaModelDefinition {
  
  /**
   * The tag of the model.
   */
  tag: string;

  /**
   * The input mime-types supported by the model.
   */
  inputs: string[];

  /**
   * The output mime-types supported by the model.
   */
  outputs: string[];
}

/**
 * An array of base input mime-types
 * supported by ollama text models.
 */
export const BASE_TEXT_INPUTS = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/x-subrip',
  'text/vtt',
  'application/json'
];

/**
 * An array of base input mime-types
 * supported by ollama multimodal models.
 */
export const BASE_IMAGE_INPUTS = [
  'image/png',
  'image/jpeg'
];

/**
 * A helper to select a model supported
 * by Ollama.
 */
export class OllamaModel {

  /**
   * The `gemma` model.
   * @see https://ollama.com/library/gemma
   */
  public static GEMMA = new OllamaModel('gemma', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `gemma2` model.
   * @see https://ollama.com/library/gemma2
   */
  public static GEMMA_2 = new OllamaModel('gemma2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `llama2` model.
   * @see https://ollama.com/library/llama2
   */
  public static LLAMA_2 = new OllamaModel('llama2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `llama3` model.
   * @see https://ollama.com/library/llama3
   */
  public static LLAMA_3 = new OllamaModel('llama3', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `mistral` model.
   * @see https://ollama.com/library/mistral
   */
  public static MISTRAL = new OllamaModel('mistral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `mixtral` model.
   * @see https://ollama.com/library/mixtral
   */
  public static MIXTRAL = new OllamaModel('mixtral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `mistral-openorca` model.
   * @see https://ollama.com/library/mistral-openorca
   */
  public static MISTRAL_OPENORCA = new OllamaModel('mistral-openorca', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `dolphin-mistral` model.
   * @see https://ollama.com/library/dolphin-mistral
   */
  public static DOLPHIN_MISTRAL = new OllamaModel('dolphin-mistral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `yarn-mistral` model.
   * @see https://ollama.com/library/yarn-mistral
   */
  public static YARN_MISTRAL = new OllamaModel('yarn-mistral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `samantha-mistral` model.
   * @see https://ollama.com/library/samantha-mistral
   */
  public static SAMANTHA_MISTRAL = new OllamaModel('samantha-mistral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `mistrallite` model.
   * @see https://ollama.com/library/mistrallite
   */
  public static MISTRAL_LITE = new OllamaModel('mistrallite', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `mistral-nemo` model.
   * @see https://ollama.com/library/mistral-nemo
   */
  public static MISTRAL_NEMO = new OllamaModel('mistral-nemo', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `mathstral` model.
   * @see https://ollama.com/library/mathstral
   */
  public static MATHSTRAL = new OllamaModel('mathstral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `llava` model.
   * @see https://ollama.com/library/llava
   */
  public static LLAVA = new OllamaModel('llava', {
    tag: 'latest',
    inputs: [
      'text/plain',
      ...BASE_IMAGE_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The `neural-chat` model.
   * @see https://ollama.com/library/neural-chat
   */
  public static NEURAL_CHAT = new OllamaModel('neural-chat', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `codellama` model.
   * @see https://ollama.com/library/codellama
   */
  public static CODE_LLAMA = new OllamaModel('codellama', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `dolphin-mixtral` model.
   * @see https://ollama.com/library/dolphin-mixtral
   */
  public static DOLPHIN_MIXTRAL = new OllamaModel('dolphin-mixtral', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `llama2-uncensored` model.
   * @see https://ollama.com/library/llama2-uncensored
   */
  public static LLAMA2_UNCENSORED = new OllamaModel('llama2-uncensored', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `orca-mini` model.
   * @see https://ollama.com/library/orca-mini
   */
  public static ORCA_MINI = new OllamaModel('orca-mini', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `phi` model.
   * @see https://ollama.com/library/phi
   */
  public static PHI = new OllamaModel('phi', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `phi3` model.
   * @see https://ollama.com/library/phi3
   */
  public static PHI_3 = new OllamaModel('phi3', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `deepseek-coder` model.
   * @see https://ollama.com/library/deepseek-coder
   */
  public static DEEPSEEK_CODER = new OllamaModel('deepseek-coder', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `deepseek-coder-v2` model.
   * @see https://ollama.com/library/deepseek-coder-v2
   */
  public static DEEPSEEK_CODER_V2 = new OllamaModel('deepseek-coder-v2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `vicuna` model.
   * @see https://ollama.com/library/vicuna
   */
  public static VICUNA = new OllamaModel('vicuna', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `zephyr` model.
   * @see https://ollama.com/library/zephyr
   */
  public static ZEPHYR = new OllamaModel('zephyr', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `openhermes` model.
   * @see https://ollama.com/library/openhermes
   */
  public static OPEN_HERMES = new OllamaModel('openhermes', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `wizardcoder` model.
   * @see https://ollama.com/library/wizardcoder
   */
  public static WIZARD_CODER = new OllamaModel('wizardcoder', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `phind-codellama` model.
   * @see https://ollama.com/library/phind-codellama
   */
  public static PHIND_CODELLAMA = new OllamaModel('phind-codellama', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `llama2-chinese` model.
   * @see https://ollama.com/library/llama2-chinese
   */
  public static LLAMA2_CHINESE = new OllamaModel('llama2-chinese', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `tinyllama` model.
   * @see https://ollama.com/library/tinyllama
   */
  public static TINY_LLAMA = new OllamaModel('tinyllama', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `openchat` model.
   * @see https://ollama.com/library/openchat
   */
  public static OPENCHAT = new OllamaModel('openchat', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `qwen` model.
   * @see https://ollama.com/library/qwen
   */
  public static QWEN = new OllamaModel('qwen', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `qwen2` model.
   * @see https://ollama.com/library/qwen2
   */
  public static QWEN_2 = new OllamaModel('qwen2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `orca2` model.
   * @see https://ollama.com/library/orca2
   */
  public static ORCA_2 = new OllamaModel('orca2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `falcon` model.
   * @see https://ollama.com/library/falcon
   */
  public static FALCON = new OllamaModel('falcon', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `wizard-math` model.
   * @see https://ollama.com/library/wizard-math
   */
  public static WIZARD_MATH = new OllamaModel('wizard-math', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `nous-hermes` model.
   * @see https://ollama.com/library/nous-hermes
   */
  public static NOUS_HERMES = new OllamaModel('nous-hermes', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `dolphin-phi` model.
   * @see https://ollama.com/library/dolphin-phi
   */
  public static DOLPHIN_PHI = new OllamaModel('dolphin-phi', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `starling-lm` model.
   * @see https://ollama.com/library/starling-lm
   */
  public static STARLING_LM = new OllamaModel('starling-lm', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `codeup` model.
   * @see https://ollama.com/library/codeup
   */
  public static CODEUP = new OllamaModel('codeup', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `starcoder` model.
   * @see https://ollama.com/library/starcoder
   */
  public static STARCODER = new OllamaModel('starcoder', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `starcoder2` model.
   * @see https://ollama.com/library/starcoder2
   */
  public static STARCODER_2 = new OllamaModel('starcoder2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `medllama2` model.
   * @see https://ollama.com/library/medllama2
   */
  public static MEDLLAMA_2 = new OllamaModel('medllama2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `yi` model.
   * @see https://ollama.com/library/yi
   */
  public static YI = new OllamaModel('yi', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `everythinglm` model.
   * @see https://ollama.com/library/everythinglm
   */
  public static EVERYTHING_LM = new OllamaModel('everythinglm', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `bakllava` model.
   * @see https://ollama.com/library/bakllava
   */
  public static BAK_LLAVA = new OllamaModel('bakllava', {
    tag: 'latest',
    inputs: [
      'text/plain',
      ...BASE_IMAGE_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The `stable-code` model.
   * @see https://ollama.com/library/stable-code
   */
  public static STABLE_CODE = new OllamaModel('stable-code', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `stable-beluga` model.
   * @see https://ollama.com/library/stable-beluga
   */
  public static STABLE_BELUGA = new OllamaModel('stable-beluga', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `solar` model.
   * @see https://ollama.com/library/solar
   */
  public static SOLAR = new OllamaModel('solar', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `sqlcoder` model.
   * @see https://ollama.com/library/sqlcoder
   */
  public static SQL_CODER = new OllamaModel('sqlcoder', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `tinydolphin` model.
   * @see https://ollama.com/library/tinydolphin
   */
  public static TINY_DOLPHIN = new OllamaModel('tinydolphin', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `dolphincoder` model.
   * @see https://ollama.com/library/dolphincoder
   */
  public static DOLPHIN_CODER = new OllamaModel('dolphincoder', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `meditron` model.
   * @see https://ollama.com/library/meditron
   */
  public static MEDITRON = new OllamaModel('meditron', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `magicoder` model.
   * @see https://ollama.com/library/magicoder
   */
  public static MAGICODER = new OllamaModel('magicoder', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `stablelm2` model.
   * @see https://ollama.com/library/stablelm2
   */
  public static STABLE_LM_2 = new OllamaModel('stablelm2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `llama-pro` model.
   * @see https://ollama.com/library/llama-pro
   */
  public static LLAMA_PRO = new OllamaModel('llama-pro', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `codebooga` model.
   * @see https://ollama.com/library/codebooga
   */
  public static CODE_BOOGA = new OllamaModel('codebooga', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `nexusraven` model.
   * @see https://ollama.com/library/nexusraven
   */
  public static NEXUS_RAVEN = new OllamaModel('nexusraven', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `goliath` model.
   * @see https://ollama.com/library/goliath
   */
  public static GOLIATH = new OllamaModel('goliath', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `notux` model.
   * @see https://ollama.com/library/notux
   */
  public static NOTUX = new OllamaModel('notux', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `alfred` model.
   * @see https://ollama.com/library/alfred
   */
  public static ALFRED = new OllamaModel('alfred', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `megadolphin` model.
   * @see https://ollama.com/library/megadolphin
   */
  public static MEGA_DOLPHIN = new OllamaModel('megadolphin', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `wizardlm` model.
   * @see https://ollama.com/library/wizardlm
   */
  public static WIZARD_LM = new OllamaModel('wizardlm', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `wizardlm2` model.
   * @see https://ollama.com/library/wizardlm2
   */
  public static WIZARD_LM_2 = new OllamaModel('wizardlm2', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `notus` model.
   * @see https://ollama.com/library/notus
   */
  public static NOTUS = new OllamaModel('notus', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `duckdb-nsql` model.
   * @see https://ollama.com/library/duckdb-nsql
   */
  public static DUCKDB_NSQL = new OllamaModel('duckdb-nsql', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `command-r` model.
   * @see https://ollama.com/library/command-r
   */
  public static COMMAND_R = new OllamaModel('command-r', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `command-r-plus` model.
   * @see https://ollama.com/library/command-r-plus
   */
  public static COMMAND_R_PLUS = new OllamaModel('command-r-plus', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `dbrx` model.
   * @see https://ollama.com/library/dbrx
   */
  public static DBRX = new OllamaModel('dbrx', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * The `aya` model.
   * @see https://ollama.com/library/aya
   */
  public static AYA = new OllamaModel('aya', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: ['text/plain']
  });

  /**
   * Create a new instance of the `OllamaModel`
   * by name.
   * @param name the path of the model on sentence-transformers.
   * @returns a new instance of the `OllamaModel`.
   */
  public static of(
    name: string,
    definition: OllamaModelDefinition
  ) {
    return (new OllamaModel(name, definition));
  }

  constructor(
    public name: string,
    public definition: OllamaModelDefinition
  ) {}

  public tag(tag: string) {
    this.definition.tag = tag;
    return (this);
  }
}
