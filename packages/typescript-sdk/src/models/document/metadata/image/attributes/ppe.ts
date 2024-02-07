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
import { Person } from './person';
import { PointerBuilder } from '../../../../../pointer';

/**
 * A description of the identified personal protective equipments
 * in an image.
 */
export const PersonalProtectiveEquipmentSchema = z.object({
  personsWithRequiredEquipment: z.number(),
  personsWithoutRequiredEquipment: z.number(),
  personsIndeterminate: z.number(),
  persons: z
  .string()
  .url()
  .transform((url) => {
    return (new PointerBuilder<Array<Person>>()
      .withUri(url)
      .withClassType(Person)
      .build());
  }).optional(),
});

export type PersonalProtectiveEquipment = z.infer<
  typeof PersonalProtectiveEquipmentSchema
>;
