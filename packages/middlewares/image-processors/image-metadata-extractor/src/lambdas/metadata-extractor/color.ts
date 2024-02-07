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
import { FastAverageColor, FastAverageColorOptions, FastAverageColorResult } from 'fast-average-color';

const fac = new FastAverageColor();

const MIN_SIZE = 10;
const MAX_SIZE = 100;

function prepareSizeAndPosition(originalSize: { width: number; height: number; }, options: FastAverageColorOptions) {
    const srcLeft = options.left ?? 0;
    const srcTop = options.top ?? 0;
    const srcWidth = options.width ?? originalSize.width;
    const srcHeight = options.height ?? originalSize.height;

    let destWidth = srcWidth;
    let destHeight = srcHeight;

    if (options.mode === 'precision') {
        return {
            srcLeft,
            srcTop,
            srcWidth,
            srcHeight,
            destWidth,
            destHeight
        };
    }

    let factor;

    if (srcWidth > srcHeight) {
        factor = srcWidth / srcHeight;
        destWidth = MAX_SIZE;
        destHeight = Math.round(destWidth / factor);
    } else {
        factor = srcHeight / srcWidth;
        destHeight = MAX_SIZE;
        destWidth = Math.round(destHeight / factor);
    }

    if (
        destWidth > srcWidth || destHeight > srcHeight ||
        destWidth < MIN_SIZE || destHeight < MIN_SIZE
    ) {
        destWidth = srcWidth;
        destHeight = srcHeight;
    }

    return {
        srcLeft,
        srcTop,
        srcWidth,
        srcHeight,
        destWidth,
        destHeight
    };
}

export async function getAverageColor(resource: string | Buffer, options: FastAverageColorOptions = {}): Promise<FastAverageColorResult> {
    let input = resource;

    if (typeof resource === 'string') {
        const base64 = resource.split(/^data:image\/.*?;base64,/)[1];

        if (base64) {
            input = Buffer.from(base64, 'base64');
        }
    }

    const left = options.left ?? 0;
    const top = options.top ?? 0;

    let pipe = await sharp(input);

    const metadata = await pipe.metadata();

    if (metadata.width && metadata.height) {
        const size = prepareSizeAndPosition({
            width: metadata.width,
            height: metadata.height,
        }, options);

        pipe = pipe.extract({
            left,
            top,
            width: size.srcWidth,
            height: size.srcHeight,
        }).resize(size.destWidth, size.destHeight);
    }

    const buffer = await pipe.ensureAlpha().raw().toBuffer();
    const pixelArray = new Uint8Array(buffer.buffer);

    return fac.prepareResult(fac.getColorFromArray4(pixelArray, options));
}