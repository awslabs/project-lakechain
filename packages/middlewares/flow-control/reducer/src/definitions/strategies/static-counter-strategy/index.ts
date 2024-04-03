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
import { ReducerStrategy } from '../strategy';

/**
 * Describes the schema of the properties associated
 * with the `StaticCounterStrategy` strategy.
 */
const StaticCounterStrategyPropsSchema = z.object({

  /**
   * A unique identifier for the strategy.
   */
  reduceType: z.literal('STATIC_COUNTER'),

  /**
   * An integer defining how many events are expected before
   * the reducer is triggered.
   */
  eventCount: z
    .number()
    .int()
    .min(1)
});

// The type of the `StaticCounterStrategyProps` schema.
export type StaticCounterStrategyProps = z.infer<typeof StaticCounterStrategyPropsSchema>;

/**
 * The `StaticCounterStrategy` builder.
 */
export class StaticCounterStrategyBuilder {

  /**
   * The strategy properties.
   */
  private props: Partial<StaticCounterStrategyProps> = {
    reduceType: 'STATIC_COUNTER'
  };

  /**
   * @param eventCount the number of events to wait for before
   * the reducer is triggered.
   * @returns the current builder instance.
   */
  public withEventCount(eventCount: number) {
    this.props.eventCount = eventCount;
    return (this);
  }

  /**
   * @returns a new instance of the `StaticCounterStrategy`
   * service constructed with the given parameters.
   */
  public build(): StaticCounterStrategy {
    return (StaticCounterStrategy.from(this.props));
  }
}

/**
 * The `StaticCounterStrategy` strategy.
 */
export class StaticCounterStrategy implements ReducerStrategy {

  /**
   * The `StaticCounterStrategy` Builder.
   */
  public static Builder = StaticCounterStrategyBuilder;

  /**
   * Creates a new instance of the `StaticCounterStrategy` class.
   * @param props the task properties.
   */
  constructor(public props: StaticCounterStrategyProps) {}

  /**
   * @returns the event count to wait for before the reducer
   * is triggered.
   */
  public eventCount() {
    return (this.props.eventCount);
  }

  /**
   * @returns the strategy name.
   */
  public name() {
    return (this.props.reduceType);
  }

  /**
   * @returns an object describing the strategy.
   */
  public compile() {
    return (this.toJSON());
  }

  /**
   * Creates a new instance of the `StaticCounterStrategy` class.
   * @param props the task properties.
   * @returns a new instance of the `StaticCounterStrategy` class.
   */
  public static from(props: any) {
    return (new StaticCounterStrategy(StaticCounterStrategyPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return ({
      reduceType: this.props.reduceType,
      eventCount: this.props.eventCount
    });
  }
}