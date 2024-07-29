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

import * as cdk from 'aws-cdk-lib';
import { z } from 'zod';
import { ReducerStrategy } from '../strategy';

/**
 * Describes the schema of the properties associated
 * with the `TimeWindowStrategy` strategy.
 */
const TimeWindowStrategyPropsSchema = z.object({

  /**
   * A unique identifier for the strategy.
   */
  reduceType: z.literal('TIME_WINDOW'),

  /**
   * A time window describing the duration during which the
   * reducer will aggregate events belonging to the same
   * execution identifier.
   */
  timeWindow: z
    .custom<cdk.Duration>((value) => typeof value !== 'undefined', {
      message: 'A time window must be provided to the strategy.'
    })
    .refine((value) => value.toSeconds() >= 1, {
      message: 'The duration must be at least 1 second.'
    })
    .refine((value) => value.toSeconds() <= 172800, {
      message: 'The duration must be at most 48 hours.'
    }),

  /**
   * A jitter value to apply to the time window in order to
   * smoothen the scheduling of the reducer.
   */
  jitter: z
    .custom<cdk.Duration>()
    .optional()
});

// The type of the `TimeWindowStrategyProps` schema.
export type TimeWindowStrategyProps = z.infer<typeof TimeWindowStrategyPropsSchema>;

/**
 * The `TimeWindowStrategy` builder.
 */
export class TimeWindowStrategyBuilder {

  /**
   * The strategy properties.
   */
  private props: Partial<TimeWindowStrategyProps> = {
    reduceType: 'TIME_WINDOW'
  };

  /**
   * @param timeWindow the duration during which the reducer
   * will aggregate events belonging to the same execution
   * identifier.
   * @returns the current builder instance.
   */
  public withTimeWindow(timeWindow: cdk.Duration) {
    this.props.timeWindow = timeWindow;
    return (this);
  }

  /**
   * @param jitter the jitter value to apply to the time window
   * in order to smoothen the scheduling of the reducer.
   * @returns the current builder instance.
   */
  public withJitter(jitter: cdk.Duration) {
    this.props.jitter = jitter;
    return (this);
  }

  /**
   * @returns a new instance of the `TimeWindowStrategy`
   * service constructed with the given parameters.
   */
  public build(): TimeWindowStrategy {
    return (TimeWindowStrategy.from(this.props));
  }
}

/**
 * The `TimeWindowStrategy` strategy.
 */
export class TimeWindowStrategy implements ReducerStrategy {

  /**
   * The `TimeWindowStrategy` Builder.
   */
  public static readonly Builder = TimeWindowStrategyBuilder;

  /**
   * Creates a new instance of the `TimeWindowStrategy` class.
   * @param props the task properties.
   */
  constructor(public props: TimeWindowStrategyProps) {}

  /**
   * @returns the time window duration.
   */
  public timeWindow() {
    return (this.props.timeWindow);
  }

  /**
   * @returns the strategy name.
   */
  public name() {
    return (this.props.reduceType);
  }

  /**
   * @returns the jitter value to apply to the time window.
   */
  public jitter() {
    return (this.props.jitter);
  }

  /**
   * @returns an object describing the strategy.
   */
  public compile() {
    return (this.toJSON());
  }

  /**
   * Creates a new instance of the `TimeWindowStrategy` class.
   * @param props the task properties.
   * @returns a new instance of the `TimeWindowStrategy` class.
   */
  public static from(props: any) {
    return (new TimeWindowStrategy(TimeWindowStrategyPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return ({
      reduceType: this.props.reduceType,
      timeWindow: this.props.timeWindow.toSeconds(),
      jitter: this.props.jitter?.toSeconds()
    });
  }
}