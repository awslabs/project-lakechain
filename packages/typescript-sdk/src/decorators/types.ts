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

import { Handler } from 'aws-lambda';
import { CloudEvent } from '../models/cloud-event/cloud-event';
import {
  AsyncHandler,
  LambdaInterface,
  SyncHandler,
} from '@aws-lambda-powertools/commons';

export type HandlerMethodDecorator = (
  target: LambdaInterface,
  propertyKey: string | symbol,
  descriptor:
    | TypedPropertyDescriptor<SyncHandler<Handler>>
    | TypedPropertyDescriptor<AsyncHandler<Handler>>
) => void;

export type MethodDecorator = (
  target: any,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<any>
) => any;

export type CloudEventFunction = (...args: any[]) => Promise<CloudEvent>;

export type CloudEventMethodDecorator = (
  target: any,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<CloudEventFunction>
) => any;
