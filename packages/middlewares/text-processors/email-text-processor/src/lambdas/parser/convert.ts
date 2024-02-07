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

import {
  MessageText,
  Headers
} from 'mailparser';

/**
 * The type of a message description.
 */
export type MessageOutput = {
  mimeType: string,
  data: string
};

/**
 * @param message the message associated with the email.
 * @returns an object describing the attributes
 * of the email.
 */
const asJson = (message: MessageText, headers: Headers): string => {
  return (JSON.stringify({
    headers: Object.fromEntries(headers),
    text: message.text,
    html: message.html
  }));
};

/**
 * Converts the given message text object to the desired
 * output format.
 * @param message the message associated with the email.
 * @param headers the headers of the email.
 * @param outputFormat the desired output format.
 * @returns an object containing the mime type and
 * the data associated with the converted email.
 */
export const convert = (
  message: MessageText,
  headers: Headers,
  outputFormat: string
): MessageOutput => {
  if (outputFormat === 'text') {
    return ({
      mimeType: 'text/plain',
      data: message.text as string
    });
  } else if (outputFormat === 'html') {
    return ({
      mimeType: 'text/html',
      data: message.html as string
    });
  } else {
    return ({
      mimeType: 'application/json',
      data: asJson(message, headers)
    });
  }
}