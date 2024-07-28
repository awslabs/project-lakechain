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

import serialize from 'serialize-javascript';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as esbuild from 'esbuild';

import { z } from 'zod';
import { ReducerStrategy } from '../strategy';
import { CloudEvent } from '@project-lakechain/sdk';

/**
 * A function expression that returns a boolean value.
 * @param event the cloud event to process.
 * @returns a promise resolving to a boolean value.
 */
export type ConditionalExpression = (
  event: Readonly<CloudEvent>,
  storedEvents: Readonly<CloudEvent>[]
) => Promise<boolean>;

/**
 * The name of the conditional callable to invoke
 * the conditional expression.
 */
const CONDITIONAL_SYMBOL = '__callable';

/**
 * Describes the schema of the properties associated
 * with the `ConditionalStrategy` strategy.
 */
const ConditionalStrategyPropsSchema = z.object({

  /**
   * A unique identifier for the strategy.
   */
  reduceType: z.literal('CONDITIONAL'),

  /**
   * A conditional expression, or a lambda function which will
   * evaluate a conditional expression.
   */
  conditional: z
    .union([
      z.custom<lambda.IFunction>(),
      z.custom<ConditionalExpression>()
    ]),

  /**
   * The serialized conditional expression.
   */
  expression: z.union([
    z.string(),
    z.function()
  ]),

  /**
   * The type of the conditional expression.
   * @note can be either 'lambda' or 'expression'.
   */
  conditionalType: z.enum(['lambda', 'expression'])
});

// The type of the `ConditionalStrategyProps` schema.
export type ConditionalStrategyProps = z.infer<typeof ConditionalStrategyPropsSchema>;

/**
 * The `ConditionalStrategy` builder.
 */
export class ConditionalStrategyBuilder {

  /**
   * The strategy properties.
   */
  private props: Partial<ConditionalStrategyProps> = {
    reduceType: 'CONDITIONAL'
  };

  /**
   * Sets the conditional expression to evaluate.
   * @param conditional a conditional expression or a reference
   * to a lambda function.
   * @returns the current builder instance.
   */
  public withConditional(conditional: ConditionalExpression | lambda.IFunction) {
    if (conditional instanceof lambda.Function) {
      this.props.conditionalType = 'lambda';
      this.props.expression = conditional.functionArn;
    } else if (typeof conditional === 'function') {
      this.props.conditionalType = 'expression';
      this.props.expression = this.serializeFn(conditional);
    }
    this.props.conditional = conditional;
    return (this);
  }

  /**
   * A helper used to serialize the different types of JavaScript
   * functions that the user can provide (e.g functions, arrow functions,
   * async functions, etc.) into a string.
   * This function also uses `esbuild` to validate the syntax of the
   * provided function and minify it.
   * @param fn the function to serialize.
   * @param opts the esbuild transform options.
   * @returns the serialized function.
   */
  private serializeFn(fn: ConditionalExpression, opts?: esbuild.TransformOptions): string {
    const res = esbuild.transformSync(`const ${CONDITIONAL_SYMBOL} = ${serialize(fn)}\n`, {
      minify: true,
      ...opts
    });
    return (res.code);
  }

  /**
   * @returns a new instance of the `ConditionalStrategy`
   * service constructed with the given parameters.
   */
  public build(): ConditionalStrategy {
    return (ConditionalStrategy.from(this.props));
  }
}

/**
 * The `ConditionalStrategy` strategy.
 */
export class ConditionalStrategy implements ReducerStrategy {

  /**
   * The `ConditionalStrategy` Builder.
   */
  public static Builder = ConditionalStrategyBuilder;

  /**
   * Creates a new instance of the `ConditionalStrategy` class.
   * @param props the task properties.
   */
  constructor(public props: ConditionalStrategyProps) {}

  /**
   * @returns the conditional expression.
   */
  public conditional() {
    return (this.props.conditional);
  }

  /**
   * @returns the serialized conditional expression.
   */
  public expression() {
    return (this.props.expression);
  }

  /**
   * @returns the conditional expression type.
   * @note can be either 'lambda' or 'expression'.
   */
  public type() {
    return (this.props.conditionalType);
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
   * Creates a new instance of the `ConditionalStrategy` class.
   * @param props the task properties.
   * @returns a new instance of the `ConditionalStrategy` class.
   */
  public static from(props: any) {
    return (new ConditionalStrategy(ConditionalStrategyPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return ({
      reduceType: this.props.reduceType,
      expression: this.props.expression,
      symbol: CONDITIONAL_SYMBOL,
      type: this.props.conditionalType
    });
  }
}