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

import { Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import type { PolicyViolation, Stack } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';

/**
 * A record containing CDK validation acknowledgments.
 */
type AcknowledgmentRecord = Readonly<Record<string, unknown>>;

/**
 * A CDK Nag rule acknowledgment.
 */
type NagAcknowledgment = {

  /**
   * The identifier of the rule to acknowledge.
   */
  readonly id: string;

  /**
   * The reason for acknowledging the rule.
   */
  readonly reason: string;
};

/**
 * Acknowledges rules on one or more constructs.
 * @param scope - The constructs on which to acknowledge the rules.
 * @param acknowledgments - The rules and reasons to acknowledge.
 */
export const acknowledge = (
  scope: IConstruct | IConstruct[],
  acknowledgments: readonly NagAcknowledgment[]
) => {
  const constructs = Array.isArray(scope) ? scope : [scope];

  for (const construct of constructs) {
    Validations.of(construct).acknowledge(...acknowledgments);
  }
};

/**
 * Acknowledges rules on the construct at the given stack path.
 * @param stack - The stack containing the construct.
 * @param path - The absolute construct path.
 * @param acknowledgments - The rules and reasons to acknowledge.
 * @throws If no construct exists at the given path.
 */
export const acknowledgeByPath = (
  stack: Stack,
  path: string,
  acknowledgments: readonly NagAcknowledgment[]
) => {
  // Resolve the exact construct to preserve the previous suppression scope.
  const construct = stack.node
    .findAll()
    .find(({ node }) => `/${node.path}` === path);

  if (!construct) {
    throw new Error(`Unable to acknowledge CDK Nag rules: ${path} was not found.`);
  }

  acknowledge(construct, acknowledgments);
};

/**
 * Checks whether a value contains CDK validation acknowledgments.
 * @param value - The value to inspect.
 * @returns Whether the value is an acknowledgment record.
 */
const isAcknowledgmentRecord = (
  value: unknown
): value is AcknowledgmentRecord => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
};

/**
 * Gets rule acknowledgment identifiers from a construct and its ancestors.
 * @param construct - The construct from which to start.
 * @returns The acknowledged rule identifiers.
 */
const getAcknowledgmentIds = (construct: IConstruct) => {
  const ids = new Set<string>();
  let current: IConstruct | undefined = construct;

  while (current) {
    for (const entry of current.node.metadata) {
      if (
        entry.type !== Validations.ACKNOWLEDGED_RULES_METADATA_KEY ||
        !isAcknowledgmentRecord(entry.data)
      ) {
        continue;
      }

      for (const id of Object.keys(entry.data)) {
        ids.add(id.replace(/^annotation::/i, ''));
      }
    }

    current = current.node.scope;
  }

  return (ids);
};

/**
 * Gets a construct from its path.
 * @param scope - The construct tree to inspect.
 * @param path - The construct path to resolve.
 * @returns The construct at the requested path.
 * @throws If the construct path cannot be resolved.
 */
const getConstructByPath = (
  scope: IConstruct,
  path: string
) => {
  const constructs = [
    scope,
    ...scope.node.findAll()
  ];
  const construct = constructs.find(({ node }) => node.path === path);

  if (!construct) {
    throw new Error(
      `Unable to resolve CDK Nag construct path: ${path}.`
    );
  }

  return (construct);
};

/**
 * Checks whether a rule is acknowledged on a construct or its ancestors.
 * @param construct - The construct that produced the rule finding.
 * @param ruleName - The complete CDK Nag rule finding identifier.
 * @returns Whether the rule finding is acknowledged.
 */
const isRuleAcknowledged = (
  construct: IConstruct,
  ruleName: string
) => {
  const ids = getAcknowledgmentIds(construct);

  return (
    [...ids].some((id) => (
      ruleName === id ||
      ruleName.startsWith(`${id}[`)
    ))
  );
};

/**
 * Gets resources with findings that have not been acknowledged.
 * @param scope - The construct tree that was validated.
 * @param violation - The CDK Nag violation to inspect.
 * @returns Resources whose findings remain unacknowledged.
 */
const getUnacknowledgedResources = (
  scope: IConstruct,
  violation: PolicyViolation
) => {
  return (
    violation.violatingResources.filter(({ constructPath }) => {
      const construct = getConstructByPath(scope, constructPath);

      return (!isRuleAcknowledged(construct, violation.ruleName));
    })
  );
};

/**
 * Gets unacknowledged CDK Nag errors for a construct tree.
 *
 * CDK Nag v3 requires exact identifiers for granular findings. This preserves
 * the broad acknowledgments used by the existing tests while continuing to
 * report any finding that does not match an acknowledged rule.
 *
 * @param scope - The construct tree to validate.
 * @returns The unacknowledged CDK Nag errors.
 */
export const getNagErrors = (scope: IConstruct) => {
  const report = new AwsSolutionsChecks(scope, {
    verbose: true
  }).validateScope(scope);

  return (
    report.violations
      .filter(({ severity }) => severity === 'error')
      .map((violation) => ({
        ...violation,
        violatingResources: getUnacknowledgedResources(scope, violation)
      }))
      .filter(({ violatingResources }) => violatingResources.length > 0)
  );
};
