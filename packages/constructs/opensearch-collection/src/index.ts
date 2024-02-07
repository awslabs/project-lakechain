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
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';

import { Construct } from 'constructs';

/**
 * A helper function to format the name of a resource.
 * @param text the text to format
 * @param maxLength the maximum length of the text
 * @returns the formatted name
 */
export const formatName = (text: string, maxLength = 32) => {
  return (text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, maxLength));
};

/**
 * The possible collection types.
 */
export type CollectionType = 'SEARCH' | 'TIMESERIES' | 'VECTORSEARCH';

/**
 * The OpenSearch collection interface.
 */
export interface ICollection extends cdk.IResource {

  /**
   * The name of the collection.
   * @attribute
   */
  readonly collectionName: string;

  /**
   * The ARN of the collection.
   * @attribute
   */
  readonly collectionArn: string;

  /**
   * The identifier of the collection.
   * @attribute
   */
  readonly collectionId: string;

  /**
   * The endpoint associated with the collection.
   * @attribute
   */
  readonly collectionEndpoint: string;

  /**
   * The endpoint associated with the collection dashboard.
   * @attribute
   */
  readonly dashboardEndpoint: string;
}

abstract class CollectionBase extends cdk.Resource implements ICollection {
  public abstract readonly collectionName: string;
  public abstract readonly collectionArn: string;
  public abstract readonly collectionId: string;
  public abstract readonly collectionEndpoint: string;
  public abstract readonly dashboardEndpoint: string;
}

/**
 * The properties for creating an OpenSearch collection.
 */
export interface CollectionProps {

  /**
   * The name of the collection.
   */
  name: string;

  /**
   * The description of the collection.
   */
  description?: string;

  /**
   * The VPC in which the OpenSearch collection is deployed.
   */
  vpc: ec2.IVpc;

  /**
   * The collection type.
   */
  type: CollectionType;
}

/**
 * The properties of an existing OpenSearch collection.
 */
export interface CollectionAttributes {

  /**
   * The name of the OpenSearch collection.
   */
  readonly collectionName: string;

  /**
   * The ARN of the OpenSearch collection.
   */
  readonly collectionArn: string;

  /**
   * The identifier of the OpenSearch collection.
   */
  readonly collectionId: string;

  /**
   * The endpoint of the OpenSearch collection.
   */
  readonly collectionEndpoint: string;

  /**
   * The dashboard endpoint of the OpenSearch collection.
   */
  readonly dashboardEndpoint: string;
}

/**
 * The OpenSearch collection construct allows to create
 * a serverless OpenSearch collection within a VPC.
 */
export class Collection extends CollectionBase implements ICollection {
  public readonly collectionName: string;
  public readonly collectionArn: string;
  public readonly collectionId: string;
  public readonly collectionEndpoint: string;
  public readonly dashboardEndpoint: string;
  public readonly cfnCollection: opensearchserverless.CfnCollection;

  /**
   * Creates a collection construct that represents an external collection.
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param attrs A `CollectionAttributes` object.
   */
  public static fromCollectionAttributes(scope: Construct, id: string, attrs: CollectionAttributes): ICollection {
    return new class extends CollectionBase {
      public readonly collectionName = attrs.collectionName;
      public readonly collectionArn = attrs.collectionArn;
      public readonly collectionId = attrs.collectionId;
      public readonly collectionEndpoint = attrs.collectionEndpoint;
      public readonly dashboardEndpoint = attrs.dashboardEndpoint;

      constructor() { super(scope, id); }
    };
  }

  /**
   * OpenSearch collection constructor.
   * @param scope the scope of the construct
   * @param id the id of the construct
   * @param props the collection properties
   */
  constructor(scope: Construct, id: string, props: CollectionProps) {
    super(scope, id);

    this.collectionName = props.name;

    // The security group associated with the domain.
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc
    });

    // Allow VPC instances to communicate with the domain.
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(443)
    );

    // Create the VPC endpoint.
    const vpcEndpoint = new opensearchserverless.CfnVpcEndpoint(this, 'VpcEndpoint', {
      name: formatName(`vpc-endpoint-${props.name}`),
      subnetIds: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
      vpcId: props.vpc.vpcId,
      securityGroupIds: [securityGroup.securityGroupId]
    });

    // The network security policy.
    const networkSecurityPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkSecurityPolicy', {
      name: formatName(`network-security-policy-${props.name}`),
      type: 'network',
      description: 'The collection network security policy.',
      policy: JSON.stringify([{
        Rules: [{
          ResourceType: 'collection',
          Resource: [`collection/${this.collectionName}`],
        }],
        AllowFromPublic: false,
        SourceVPCEs: [vpcEndpoint.attrId]
      }])
    });

    networkSecurityPolicy.addDependency(vpcEndpoint);

    // The encryption security policy.
    const encryptionSecurityPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionSecurityPolicy', {
      name: formatName(`encryption-security-policy-${props.name}`),
      type: 'encryption',
      description: 'The collection security encryption policy.',
      policy: JSON.stringify({
        Rules: [{
          ResourceType: 'collection',
          Resource: [`collection/${this.collectionName}`]
        }],
        AWSOwnedKey: true
      })
    });

    encryptionSecurityPolicy.addDependency(networkSecurityPolicy);

    // Create the OpenSearch collection.
    this.cfnCollection = new opensearchserverless.CfnCollection(this, 'Resource', {
      name: props.name,
      description: props.description,
      type: props.type
    });

    this.cfnCollection.addDependency(networkSecurityPolicy);
    this.cfnCollection.addDependency(encryptionSecurityPolicy);

    this.collectionArn = this.cfnCollection.attrArn;
    this.collectionId = this.cfnCollection.attrId;
    this.collectionEndpoint = this.cfnCollection.attrCollectionEndpoint;
    this.dashboardEndpoint = this.cfnCollection.attrDashboardEndpoint;
  }

  /**
   * Creates a new access policy for the collection.
   * @param name the name of the access policy.
   * @param principal the principal to grant access to.
   * @param permissions the permissions to grant.
   */
  public addAccessPolicy(
    name: string,
    principal: (string | undefined)[],
    permissions: string[]
  ) {
    new opensearchserverless.CfnAccessPolicy(this, `AccessPolicy-${name}`, {
      name: formatName(`access-policy-${name}`),
      type: 'data',
      policy: JSON.stringify([{
        Rules: [{
          ResourceType: 'index',
          Resource: [`index/${this.collectionName}/*`],
          Permission: permissions
        }],
        Principal: principal
      }])
    });
  }
}
