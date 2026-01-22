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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';

import { Construct } from 'constructs';

/**
 * The properties for the `OpenSearchDomain` construct.
 */
export interface OpenSearchDomainProps {

  /**
   * The VPC in which the OpenSearch domain will be deployed.
   */
  vpc: ec2.IVpc;

  /**
   * Additional OpenSearch options to use when creating the domain.
   */
  opts?: Partial<opensearch.DomainProps>;

  /**
   * An optional reference to an existing user pool to use for
   * authentication purposes.
   */
  existingUserPool?: cognito.UserPool;
}

/**
 * The OpenSearch domain construct allows to create a managed
 * OpenSearch domain with a user pool and identity pool for
 * authenticating to the OpenSearch dashboard.
 */
export class OpenSearchDomain extends Construct {

  /**
   * The OpenSearch domain.
   */
  public readonly domain: opensearch.Domain;

  /**
   * The security group associated with the domain.
   */
  public securityGroup: ec2.SecurityGroup;

  /**
   * The user pool associated with the domain.
   */
  public readonly userPool: cognito.UserPool;

  /**
   * OpenSearch domain constructor.
   * @param scope the scope of the construct
   * @param id the id of the construct
   */
  constructor(scope: Construct, id: string, props: OpenSearchDomainProps) {
    super(scope, id);

    // The security group associated with the domain.
    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true
    });

    // Allow VPC instances to communicate with the domain.
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(443)
    );

    // Create a user pool that will be integrated with the domain
    // for authentication purposes.
    this.userPool = props.existingUserPool ?? new cognito.UserPool(this, 'Userpool', {
      signInAliases: { username: true, email: false },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSymbols: true
      },
      selfSignUpEnabled: false
    });

    // Set a domain name on the user pool to allow users to sign in
    // to the OpenSearch dashboard.
    this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: cdk.Fn.join('-', [
          cdk.Fn.select(0,
            cdk.Fn.split('-', cdk.Fn.select(2, cdk.Fn.split('/', cdk.Stack.of(this).stackId)))
          )
        ])
      }
    });

    // The identity pool associated with the domain.
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false
    });

    // Create an authenticated role for the identity pool.
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      )
    });

    // Attach the authenticated role to the identity pool.
    new cognito.CfnIdentityPoolRoleAttachment(this, 'identityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: { authenticated: authenticatedRole.roleArn },
    });

    // Create the OpenSearch domain.
    this.domain = new opensearch.Domain(this, 'Domain', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: { enabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      vpc: props.vpc,
      securityGroups: [this.securityGroup],
      tlsSecurityPolicy: opensearch.TLSSecurityPolicy.TLS_1_2,
      cognitoDashboardsAuth: {
        identityPoolId: identityPool.ref,
        userPoolId: this.userPool.userPoolId,
        role: new iam.Role(this, 'CognitoAccessForAmazonOpenSearch', {
          assumedBy: new iam.ServicePrincipal('opensearchservice.amazonaws.com'),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOpenSearchServiceCognitoAccess')
          ]
        })
      },
      ...props.opts
    });

    // Allow IAM users from the current account to interact with the domain.
    this.domain.addAccessPolicies(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountPrincipal(cdk.Aws.ACCOUNT_ID)],
        actions: [
          'es:ESHttpGet',
          'es:ESHttpPost'
        ],
        resources: [
          `${this.domain.domainArn}/*`
        ]
      })
    );

    // Allow users to sign-in using the user pool.
    this.domain.addAccessPolicies(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(authenticatedRole.roleArn)],
        actions: [
          'es:*'
        ],
        resources: [
          `${this.domain.domainArn}/*`
        ]
      })
    );
  }
}