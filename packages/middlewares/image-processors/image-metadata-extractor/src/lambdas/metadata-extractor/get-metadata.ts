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

import sharp from 'sharp';
import exifr from 'exifr';

import { DocumentMetadata, Geolocation, Color } from '@project-lakechain/sdk/models';
import { logger } from '@project-lakechain/sdk/powertools';
import { getAverageColor } from './color.js';

/**
 * The EXIF tags to extract from the image.
 */
const exifTags = [
  'Make',
  'Model',
  'Orientation',
  'PersonInImage',
  'Copyright',
  'Rating'
];

/**
 * @param exif the EXIF data to extract the authors from.
 * @returns the authors of the image if found in
 * the EXIF data, an empty array otherwise.
 */
const getAuthors = (exif: any): string[] => {
  if (exif) {
    if (typeof exif.creator === 'string') {
      return ([exif.creator.trim()]);
    }

    if (typeof exif.Artist === 'string') {
      return ([exif.Artist.trim()]);
    }
  }
  return ([]);
};

/**
 * @param exif the EXIF data to extract the keywords from.
 * @returns the keywords of the image if found in
 * the EXIF data, an empty array otherwise.
 */
const getKeywords = (exif: any): string[] => {
  if (exif && Array.isArray(exif.subject)) {
    return (exif.subject.map((keyword: string) => keyword.trim()));
  }
  return ([]);
};

/**
 * @param exif the EXIF data to extract the creation date from.
 * @returns the creation date of the image if found in
 * the EXIF data, null otherwise.
 */
const getCreatedAt = (exif: any): Date | null => {
  try {
    if (exif && typeof exif.CreateDate === 'string') {
      return (new Date(exif.CreateDate));
    }
    return (null);
  } catch (err) {
    return (null);
  }
};

/**
 * @param exif the EXIF data to extract the update date from.
 * @returns the latest update date of the image if found in
 * the EXIF data, null otherwise.
 */
const getUpdatedAt = (exif: any): Date | null => {
  try {
    if (exif && typeof exif.ModifyDate === 'string') {
      return (new Date(exif.ModifyDate));
    }
    return (null);
  } catch (err) {
    return (null);
  }
};

/**
 * Attempts to infer the title of the document by looking
 * at its metadata.
 * @param exif the EXIF data to extract the title from.
 * @returns the title of the image if found in
 * the EXIF data, null otherwise.
 */
const getTitle = (exif: any): string | null => {
  if (exif && typeof exif.Title === 'object' && typeof exif.Title.value === 'string') {
    return (exif.Title.value.trim());
  }
  return (null);
};

/**
 * @param exif the EXIF data to extract the description from.
 * @returns the textual description of the image if found in
 * the EXIF data, null otherwise.
 */
const getDescription = (exif: any): string | null => {
  if (exif) {
    if (typeof exif.ImageDescription === 'string') {
      return (exif.ImageDescription.trim());
    }

    if (typeof exif.Headline === 'string') {
      return (exif.Headline.trim());
    }

    if (typeof exif.description === 'object' && typeof exif.description.value === 'string') {
      return (exif.description.value.trim());
    }
  }
  return (null);
};

/**
 * @param exif the EXIF data to extract the geolocation from.
 * @returns the geolocation of the image if found in
 * the EXIF data, null otherwise.
 */
const getGeolocation = (exif: any): Geolocation | null => {
  if (exif?.latitude && exif?.longitude) {
    return ({
      latitude: exif.latitude,
      longitude: exif.longitude
    });
  }
  return (null);
};

/**
 * @param exif the EXIF data to extract the EXIF tags from.
 * @returns the EXIF tags of the image if found in
 * the EXIF data, an empty object otherwise.
 */
const getExifTags = (exif: any): any => {
  if (exif) {
    return (Object.fromEntries(
      Object
        .entries(exif)
        .filter(([key]) => exifTags.includes(key))
    ));
  }
  return ({});
};

/**
 * @param image the buffer containing the image
 * to extract the vibrant colors from.
 * @returns the vibrant colors of the image if found in
 * the EXIF data, an undefined value otherwise.
 */
const getVibrantColor = async (image: Buffer): Promise<Color | undefined> => {
  try {
    const { value } = await getAverageColor(image);
    return ({
      red: value[0],
      green: value[1],
      blue: value[2]
    });
  } catch (err) {
    return (undefined);
  }
};

/**
 * @param image the buffer containing the image
 * to extract metadata from.
 * @returns a new document instance with the
 * object information.
 */
export const getMetadata = async (image: Buffer): Promise<DocumentMetadata> => {
  // Create the metadata object.
  const metadata: DocumentMetadata = {};

  // We set the kind of the document.
  metadata.properties = {
    kind: 'image',
    attrs: {}
  };

  // Image header metadata extraction.
  try {
    const img = await sharp(image).metadata();

    // We save the dimensions of the image.
    if (img.width && img.height) {
      metadata.properties.attrs.dimensions = {
        width: img.width,
        height: img.height
      };
    }

    // We save the image orientation.
    if (img.orientation) {
      metadata.properties.attrs.orientation = img.orientation;
    }
  } catch (err) {
    logger.error(err as any);
  }

  // EXIF and XMP data metadata extraction.
  try {
    const exif = await exifr.parse(image, { xmp: true });

    metadata.authors = getAuthors(exif);
    metadata.keywords = getKeywords(exif);
    metadata.properties.attrs.exif = getExifTags(exif);

    const dominantColor = await getVibrantColor(image);
    const createdAt     = getCreatedAt(exif);
    const updatedAt     = getUpdatedAt(exif);
    const title         = getTitle(exif);
    const description   = getDescription(exif);
    const geolocation   = getGeolocation(exif);

    if (dominantColor) {
      metadata.properties.attrs.dominantColor = dominantColor;
    }
    if (geolocation) {
      metadata.properties.attrs.geolocation = geolocation;
    }
    if (createdAt) {
      metadata.createdAt = createdAt.toISOString();
    }
    if (updatedAt) {
      metadata.updatedAt = updatedAt.toISOString();
    }
    if (title) {
      metadata.title = title;
    }
    if (description) {
      metadata.description = description;
    }
    return (metadata);
  } catch (err) {
    logger.error(err as any);
  }

  return (metadata);
};