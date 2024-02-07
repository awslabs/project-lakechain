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
  AffineOptions,
  AvifOptions,
  BoolEnum,
  ClaheOptions,
  Color,
  ExtendOptions,
  FlattenOptions,
  GifOptions,
  HeifOptions,
  JpegOptions,
  Kernel,
  Matrix2x2,
  Matrix3x3,
  NegateOptions,
  NormaliseOptions,
  PngOptions,
  Raw,
  RawOptions,
  Region,
  ResizeOptions,
  RotateOptions,
  Sharp,
  SharpOptions,
  SharpenOptions,
  ThresholdOptions,
  TiffOptions,
  TrimOptions,
  WebpOptions,
  WriteableMetadata,
  OverlayOptions
} from './decl.d';

/**
 * Represents a captured Sharp operation.
 */
export interface Operation {

  /**
   * The name of the method invoked on the
   * Sharp API.
   */
  method: string;

  /**
   * The arguments passed to the method.
   */
  args: any[];

  /**
   * An optional output type descriptor,
   * identifying the output mime-type and
   * extension from the current operation.
   */
  outputType?: {
    mimeType: string;
    extension: string;
  };
}

/**
 * @param v the value to check.
 * @returns true if the value is defined.
 */
const def = (v: any) => typeof v !== 'undefined';

/**
 * The SharpOperations class is a wrapper around the
 * Sharp API that allows to capture the operations
 * performed on the local Sharp API and to forward
 * them to the remote compute.
 *
 * This allows users of the AWS CDK to express Sharp
 * operations in a similar way to how they would
 * express them locally.
 */
export class SharpOperations implements Sharp {

  /**
   * An array of the operations to capture on the local
   * Sharp API and to forward to the remote compute.
   */
  private ops: Operation[];

  constructor() {
    this.ops = [];
  }

  ensureAlpha(alpha?: number | undefined): SharpOperations {
    this.ops.push({ method: 'ensureAlpha', args: def(alpha) ? [alpha] : [] });
    return (this);
  }

  extractChannel(channel: 0 | 3 | 2 | 1 | 'red' | 'green' | 'blue' | 'alpha'): SharpOperations {
    this.ops.push({ method: 'extractChannel', args: [channel] });
    return (this);
  }

  joinChannel(images: string | Buffer | ArrayLike<string | Buffer>, options?: SharpOptions | undefined): SharpOperations {
    const args: any[] = [images];

    if (options !== undefined) {
      args.push(options);
    }
    this.ops.push({ method: 'joinChannel', args });
    return (this);
  }

  bandbool(boolOp: keyof BoolEnum): SharpOperations {
    this.ops.push({ method: 'bandbool', args: [boolOp] });
    return (this);
  }

  tint(rgb: Color): SharpOperations {
    this.ops.push({ method: 'tint', args: [rgb] });
    return (this);
  }

  greyscale(greyscale?: boolean | undefined): SharpOperations {
    this.ops.push({ method: 'greyscale', args: def(greyscale) ? [greyscale] : [] });
    return (this);
  }

  grayscale(grayscale?: boolean | undefined): SharpOperations {
    return (this.greyscale(grayscale));
  }

  pipelineColourspace(colourspace?: string | undefined): SharpOperations {
    this.ops.push({ method: 'pipelineColourspace', args: def(colourspace) ? [colourspace] : [] });
    return (this);
  }

  pipelineColorspace(colorspace?: string | undefined): SharpOperations {
    return (this.pipelineColourspace(colorspace));
  }

  toColourspace(colourspace?: string | undefined): SharpOperations {
    this.ops.push({ method: 'toColourspace', args: def(colourspace) ? [colourspace] : [] });
    return (this);
  }

  toColorspace(colorspace: string): SharpOperations {
    return (this.toColourspace(colorspace));
  }

  composite(images: OverlayOptions[]): SharpOperations {
    this.ops.push({ method: 'composite', args: [images] });
    return (this);
  }

  rotate(angle?: number | undefined, options?: RotateOptions | undefined): SharpOperations {
    const args: any[] = [];

    if (angle !== undefined) {
      args.push(angle);
    }
    if (options !== undefined) {
      args.push(options);
    }
    this.ops.push({ method: 'rotate', args });
    return (this);
  }

  flip(flip?: boolean | undefined): SharpOperations {
    this.ops.push({ method: 'flip', args: def(flip) ? [flip] : [] });
    return (this);
  }

  flop(flop?: boolean | undefined): SharpOperations {
    this.ops.push({ method: 'flop', args: def(flop) ? [flop] : [] });
    return (this);
  }

  affine(matrix: [number, number, number, number] | Matrix2x2, options?: AffineOptions | undefined): SharpOperations {
    const args: any[] = [matrix];

    if (options !== undefined) {
      args.push(options);
    }
    this.ops.push({ method: 'affine', args });
    return (this);
  }

  sharpen(options?: SharpenOptions): SharpOperations {
    this.ops.push({ method: 'sharpen', args: def(options) ? [options] : [] });
    return (this);
  }

  median(size?: number | undefined): SharpOperations {
    this.ops.push({ method: 'median', args: def(size) ? [size] : [] });
    return (this);
  }

  blur(sigma?: number | boolean | undefined): SharpOperations {
    this.ops.push({ method: 'blur', args: def(sigma) ? [sigma] : [] });
    return (this);
  }

  flatten(flatten?: boolean | FlattenOptions | undefined): SharpOperations {
    this.ops.push({ method: 'flatten', args: def(flatten) ? [flatten] : [] });
    return (this);
  }

  unflatten(): SharpOperations {
    this.ops.push({ method: 'unflatten', args: [] });
    return (this);
  }

  gamma(gamma?: number | undefined, gammaOut?: number | undefined): SharpOperations {
    const args: any[] = [];

    if (gamma !== undefined) {
      args.push(gamma);
    }
    if (gammaOut !== undefined) {
      args.push(gammaOut);
    }
    this.ops.push({ method: 'gamma', args });
    return (this);
  }

  negate(negate?: boolean | NegateOptions | undefined): SharpOperations {
    this.ops.push({ method: 'negate', args: def(negate) ? [negate] : [] });
    return (this);
  }

  normalise(normalise?: NormaliseOptions | undefined): SharpOperations {
    this.ops.push({ method: 'normalise', args: def(normalise) ? [normalise] : [] });
    return (this);
  }

  normalize(normalize?: NormaliseOptions | undefined): SharpOperations {
    this.ops.push({ method: 'normalize', args: def(normalize) ? [normalize] : [] });
    return (this);
  }

  clahe(options: ClaheOptions): SharpOperations {
    this.ops.push({ method: 'clahe', args: [options] });
    return (this);
  }

  convolve(kernel: Kernel): SharpOperations {
    this.ops.push({ method: 'convolve', args: [kernel] });
    return (this);
  }

  threshold(threshold?: number | undefined, options?: ThresholdOptions | undefined): SharpOperations {
    const args: any[] = [];

    if (threshold !== undefined) {
      args.push(threshold);
    }
    if (options !== undefined) {
      args.push(options);
    }
    this.ops.push({ method: 'threshold', args });
    return (this);
  }

  boolean(operand: string | Buffer, operator: keyof BoolEnum, options?: { raw: Raw; } | undefined): SharpOperations {
    const args: any[] = [operand, operator];

    if (options !== undefined) {
      args.push(options);
    }
    this.ops.push({ method: 'boolean', args });
    return (this);
  }

  linear(a?: number | number[] | null | undefined, b?: number | number[] | undefined): SharpOperations {
    const args: any[] = [];

    if (a !== undefined) {
      args.push(a);
    }
    if (b !== undefined) {
      args.push(b);
    }
    this.ops.push({ method: 'linear', args });
    return (this);
  }

  recomb(inputMatrix: Matrix3x3): SharpOperations {
    this.ops.push({ method: 'recomb', args: [inputMatrix] });
    return (this);
  }

  modulate(options?: { brightness?: number | undefined; saturation?: number | undefined; hue?: number | undefined; lightness?: number | undefined; } | undefined): SharpOperations {
    this.ops.push({ method: 'modulate', args: def(options) ? [options] : [] });
    return (this);
  }

  withMetadata(withMetadata?: WriteableMetadata | undefined): SharpOperations {
    this.ops.push({ method: 'withMetadata', args: def(withMetadata) ? [withMetadata] : [] });
    return (this);
  }

  jpeg(options?: JpegOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'jpeg',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/jpeg',
        extension: 'jpg'
      }
    });
    return (this);
  }

  png(options?: PngOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'png',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/png',
        extension: 'png'
      }
    });
    return (this);
  }

  webp(options?: WebpOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'webp',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/webp',
        extension: 'webp'
      }
    });
    return (this);
  }

  gif(options?: GifOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'gif',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/gif',
        extension: 'gif'
      }
    });
    return (this);
  }

  avif(options?: AvifOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'avif',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/avif',
        extension: 'avif'
      }
    });
    return (this);
  }

  heif(options?: HeifOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'heif',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/heif',
        extension: 'heif'
      }
    });
    return (this);
  }

  tiff(options?: TiffOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'tiff',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'image/tiff',
        extension: 'tiff'
      }
    });
    return (this);
  }

  raw(options?: RawOptions | undefined): SharpOperations {
    this.ops.push({
      method: 'raw',
      args: def(options) ? [options] : [],
      outputType: {
        mimeType: 'application/octet-stream',
        extension: 'raw'
      }
    });
    return (this);
  }

  resize(widthOrOptions?: number | ResizeOptions | null, height?: number | null, options?: ResizeOptions): SharpOperations {
    const args: any[] = [];

    if (widthOrOptions !== undefined) {
      args.push(widthOrOptions);
    }
    if (height !== undefined) {
      args.push(height);
    }
    if (options !== undefined) {
      args.push(options);
    }
    this.ops.push({ method: 'resize', args });
    return (this);
  }

  extend(extend: number | ExtendOptions): SharpOperations {
    this.ops.push({ method: 'extend', args: [extend] });
    return (this);
  }

  extract(region: Region): SharpOperations {
    this.ops.push({ method: 'extract', args: [region] });
    return (this);
  }

  trim(trim?: string | number | TrimOptions | undefined): SharpOperations {
    this.ops.push({ method: 'trim', args: def(trim) ? [trim] : [] });
    return (this);
  }

  removeAlpha(): SharpOperations {
    this.ops.push({ method: 'removeAlpha', args: [] });
    return (this);
  }

  getOps(): Operation[] {
    return (this.ops);
  }
}

/**
 * Creates a sharp instance from an image.
 * @returns A sharp instance that can be used to chain operations
 */
export function sharp(): SharpOperations {
  return (new SharpOperations());
}