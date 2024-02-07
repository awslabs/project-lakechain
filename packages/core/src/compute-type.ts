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

/**
 * Defines the compute preference for running
 * a middleware. By default, a middleware will
 * run on its preferred and most optimized compute
 * type. However, you can override this behavior
 * by explicitly specifying a compute type using
 * the middleware API.
 *
 * @note not all middlewares support different
 * compute types, and might only support
 * one of the available compute types.
 */
export enum ComputeType {

  /**
   * Runs the middleware on CPU.
   */
  CPU = 'CPU',

  /**
   * Runs the middleware on GPU.
   */
  GPU = 'GPU',

  /**
   * Runs the middleware on an accelerator,
   * such as the Inferentia chip.
   */
  ACCELERATOR = 'ACCELERATOR'
}