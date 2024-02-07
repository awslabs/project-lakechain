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

import set from 'lodash/set';
import get from 'lodash/get';
import merge from 'lodash/merge';

/**
 * Numeric range operators supported by SNS.
 */
type RangeOperator = '<' | '>' | '<=' | '>=';

/**
 * A condition allowing to describe a conditional logic on a given attribute.
 * This class is used to translate a conditional statement using a fluent
 * API, into a valid SNS conditional object.
 * @note You should not use this class directly, but use the `when()`
 * conditional element of the API to create a new conditional statement.
 */
export class Condition {

  /**
   * Whether the condition is negated using
   * the `not` operator.
   */
  private negated: boolean;

  /**
   * The hierarchy of objects to describe how to address
   * a given attribute.
   */
  private scope: object;

  /**
   * The element in the message metadata to apply the
   * conditional statement on.
   */
  private subject: string;

  /**
   * Condition constructor.
   * @param subject the element in the message metadata
   * to apply the conditional statement on.
   */
  constructor(subject: string) {
    this.negated = false;
    this.subject = subject;
    this.scope = this.createScope(subject);
  }

  /**
   * Initializes the scope of the conditional statement.
   * The scope represents the hierarchy of objects used to
   * address a given attribute.
   * For example, in SNS filtering, the subject `foo.bar` will
   * result in the following scope :
   *
   * {
   *   "foo": {
   *     "bar": {}
   *   }
   * }
   * @param subject the element in the message metadata to
   * apply the conditional statement on.
   * @returns the created scope.
   */
  private createScope(subject: string) {
    const paths = subject.split('.');
    const value = {};

    // Transform the key object path into a scope hierarchy and set
    // the subject to the last key.
    paths.reduce((scope: any, key) => {
      scope[key] = {};
      return (scope[key]);
    }, value);

    return (value);
  }

  /**
   * The `equals` operator allows to express strict equality
   * conditionals on a string or numeric value.
   * @param value the value to check the subject against.
   * @returns a new conditional statement.
   */
  public equals(value: string | number) {
    if (typeof value === 'string') {
      return (this.includes(value));
    } else {
      if (this.negated) {
        throw new Error(
          'Strict equal numeric value conditionals with the `not` operator are not supported by SNS.'
        );
      } else {
        set(this.scope, this.subject, [{"numeric": ["=", value]}]);
      }
    }
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `lt` operator allows to express a less than
   * conditional on a numeric value.
   * @param value the value to check the subject against.
   * @returns a new conditional statement.
   */
  public lt(value: number) {
    if (this.negated) {
      set(this.scope, this.subject, [{"numeric": [">=", value]}]);
    } else {
      set(this.scope, this.subject, [{"numeric": ["<", value]}]);
    }
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `gt` operator allows to express a greater than
   * conditional on a numeric value.
   * @param value the value to check the subject against.
   * @returns a new conditional statement.
   */
  public gt(value: number) {
    if (this.negated) {
      set(this.scope, this.subject, [{"numeric": ["<=", value]}]);
    } else {
      set(this.scope, this.subject, [{"numeric": [">", value]}]);
    }
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `lte` operator allows to express a less than or
   * equal conditional on a numeric value.
   * @param value the value to check the subject against.
   * @returns a new conditional statement.
   */
  public lte(value: number) {
    return (this.not().gt(value));
  }

  /**
   * The `gte` operator allows to express a greater than or
   * equal conditional on a numeric value.
   * @param value the value to check the subject against.
   * @returns a new conditional statement.
   */
  public gte(value: number) {
    return (this.not().lt(value));
  }

  /**
   * The `between` operator allows to express a range
   * conditional on a numeric value.
   * @param value the value to check the subject against.
   * @returns a new conditional statement.
   */
  public between(operand_1: number, operand_2: number) {
    const gteOp: RangeOperator = '>=';
    const lteOp: RangeOperator = '<=';

    if (this.negated) {
      throw new Error('Range comparisons do not support the `not` operator.');
    }
    set(this.scope, this.subject, [{"numeric": [gteOp, operand_1, lteOp, operand_2]}]);
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `includes` operator allows to express a conditional
   * on a string or numeric set of values.
   * @param values the values to check the subject against.
   * @returns a new conditional statement.
   */
  public includes(...values: string[] | number[]) {
    if (typeof values[0] === 'string') {
      if (this.negated) {
        set(this.scope, this.subject, [{"anything-but": [...values]}]);
      } else {
        set(this.scope, this.subject, [...values]);
      }
    } else {
      if (!this.negated) {
        throw new Error('Cannot use numeric values with `includes`.');
      }
      set(this.scope, this.subject, [{"anything-but": [...values]}]);
    }
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `startsWith` operator allows to express a conditional
   * on a string prefix.
   * @param value the prefix to check the subject against.
   * @returns a new conditional statement.
   */
  public startsWith(value: string) {
    if (this.negated) {
      set(this.scope, this.subject, [{"anything-but": {"prefix": value}}]);
    } else {
      set(this.scope, this.subject, [{"prefix": value}]);
    }
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `exists` operator allows to express a conditional
   * on the existence of a given attribute.
   * @returns a new conditional statement.
   */
  public exists() {
    set(this.scope, this.subject, [{ exists: !this.negated }]);
    return (new ConditionalStatement(this.scope, this.subject));
  }

  /**
   * The `not` operator allows to negate the current
   * conditional statement.
   * @returns the current conditional statement.
   */
  public not() {
    this.negated = !this.negated;
    return (this);
  }

  /**
   * @returns whether the current conditional statement
   * is negated.
   */
  public isNegated() {
    return (this.negated);
  }

  /**
   * @returns the JSON representation of the current
   * conditional statement.
   */
  public getScope() {
    return (this.scope);
  }

  /**
   * @returns the subject of the conditional statement.
   */
  public getSubject() {
    return (this.subject);
  }
}

/**
 * A conditional statement holds the result of different
 * conditions, translated into the SNS filtering syntax.
 * It allows users to chain multiple conditions using the
 * `and` operator.
 */
export class ConditionalStatement {

  constructor(
    private aggregate: object,
    private subjectValue: string
  ) {}

  /**
   * @returns an empty conditional statement.
   */
  static empty() {
    return (new ConditionalStatement({}, ''));
  }

  /**
   * The `and` operator allows to chain multiple conditions
   * on the same subject.
   * @param condition the condition to add to the current
   * conditional statement.
   * @returns the current conditional statement.
   */
  public and(condition: ConditionalStatement) {
    const existing = get(this.aggregate, condition.subject());

    if (existing) {
      throw new Error(
        `Cannot apply multiple conditions on the same subject: ${condition.subject()}`
      );
    }
    merge(this.aggregate, condition.value());
    return (this);
  }

  /**
   * @returns the SNS filtering syntax associated with
   * the conditional statement.
   */
  public value() {
    return (this.aggregate);
  }

  /**
   * @returns the subject of the conditional statement.
   */
  public subject() {
    return (this.subjectValue);
  }

  /**
   * @returns the JSON representation of the conditional
   * statement.
   */
  public toJSON() {
    return (this.value());
  }
}

/**
 * Creates a new conditional statement using
 * the given subject.
 * @param subject the element in the message metadata
 * to apply the conditional statement on.
 * @returns a new incomplete conditional statement.
 */
export const when = (subject: string) => new Condition(subject);
