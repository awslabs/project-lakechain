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

import * as iam from 'aws-cdk-lib/aws-iam';
import { TranscribeAudioProcessorProps } from './opts';

/**
 * @param opts the options to compile.
 * @param outputBucket the bucket where the transcription
 * results should be stored.
 * @returns a compiled object that can be passed to the
 * Amazon Transcribe `StartTranscriptionJob` API.
 */
export const compile = (
  opts: TranscribeAudioProcessorProps,
  outputBucket: string,
  transcriptionRole: iam.IRole
): any => {
  const outputs = opts.outputFormats.filter(output => output === 'vtt' || output === 'srt');

  const compiled: any = {
    Settings: {},
    OutputBucketName: outputBucket,
    OutputKey: 'transcriptions/',
    IdentifyLanguage: true,
    JobExecutionSettings: {
      AllowDeferredExecution: true,
      DataAccessRoleArn: transcriptionRole.roleArn
    },
    Subtitles: {
      Formats: outputs
    }
  };

  return (compiled);
};