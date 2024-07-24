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

import { logger } from '@project-lakechain/sdk/powertools';
import { CacheStorage } from '@project-lakechain/sdk/cache';
import { DocumentMetadata } from '@project-lakechain/sdk/models/document';

/**
 * The middleware cache storage.
 */
const cacheStorage = new CacheStorage();

/**
 * @param picture a picture object provided by the
 * `music-metadata` library.
 * @returns an image description object.
 */
const getImage = (picture: any) => {
  return ({
    type: picture.format,
    data: picture.data.toString('base64')
  });
};

/**
 * A small helper allowing 
 * @param num the number to convert into a decimal
 * fixed digits number.
 * @param digits the number of decimal digits to keep.
 * @param base the base associated with the number.
 */
const toFixed = (num: number, digits = 0, base = 10) => {
  const pow = Math.pow(base, digits);
  return (Math.round(num * pow) / pow);
};

/**
 * @param audio the buffer containing the audio
 * to extract metadata from.
 * @returns a new document instance with the
 * object information.
 */
export const getMetadata = async (audio: Buffer): Promise<DocumentMetadata> => {
  // Create the metadata object.
  const metadata: DocumentMetadata = {};
  metadata.properties = {
    kind: 'audio',
    attrs: {}
  };

  // Dynamically load the music-metadata library.
  const { parseBuffer } = await import('music-metadata');

  // Audio header metadata extraction.
  try {
    const data = await parseBuffer(audio);

    // Lossless flag.
    if (data.format.lossless) {
      metadata.properties.attrs.lossless = data.format.lossless;
    }

    // Codec.
    if (data.format.codec) {
      metadata.properties.attrs.codec = data.format.codec;
    }

    // Bitrate.
    if (data.format.bitrate) {
      metadata.properties.attrs.bitrate = toFixed(data.format.bitrate);
    }

    // Sample rate.
    if (data.format.sampleRate) {
      metadata.properties.attrs.sampleRate = data.format.sampleRate;
    }

    // Number of channels.
    if (data.format.numberOfChannels) {
      metadata.properties.attrs.channels = data.format.numberOfChannels;
    }

    // Duration.
    if (data.format.duration) {
      metadata.properties.attrs.duration = toFixed(data.format.duration, 2);
    }

    // Creation and modification time.
    if (data.format.creationTime) {
      metadata.createdAt = data.format.creationTime.toISOString();
    }
    if (data.format.modificationTime) {
      metadata.updatedAt = data.format.modificationTime.toISOString();
    }

    // Title of the audio file.
    if (data.common.title) {
      metadata.title = data.common.title;
    }

    // Artists.
    if (data.common.artists) {
      metadata.authors = data.common.artists;
    }

    // Album art.
    if (data.common.picture?.[0]?.data) {
      metadata.image = (await cacheStorage
        .put('cover', getImage(data.common.picture[0])))
        .getUri()
        .toString();
    }

    // Description.
    if (data.common.description?.[0]) {
      metadata.description = data.common.description[0];
    }

    // Keywords.
    if (data.common.keywords) {
      metadata.keywords = data.common.keywords;
    }

    // Language.
    if (data.common.language) {
      metadata.language = data.common.language;
    }
  } catch (err) {
    logger.error(err as any);
  }

  return (metadata);
};
