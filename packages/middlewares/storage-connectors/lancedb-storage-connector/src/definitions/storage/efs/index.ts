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

import path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';

import { z } from 'zod';
import { Construct } from 'constructs';
import { LanceDbStorage } from '../storage';

/**
 * Describes the schema for the EFS storage.
 */
const EfsStoragePropsSchema = z.object({

  /**
   * A unique identifier for the storage.
   */
  id: z.literal('EFS_STORAGE'),

  /**
   * The VPC in which the EFS storage should be deployed.
   */
  vpc: z.custom<ec2.IVpc>((vpc) => {
    if (!vpc) {
      throw new Error('VPC is required for EFS storage.');
    }
    return (vpc);
  }, {
    message: 'A VPC is required for the EFS storage.'
  }),
  
  /**
   * The path to the LanceDB dataset on the file-system.
   */
  path: z
    .string()
    .default('')
});

// The type of the `EfsStorageProps` schema.
export type EfsStorageProps = z.infer<typeof EfsStoragePropsSchema>;

/**
 * The EFS storage builder.
 */
export class EfsStorageBuilder {

  /**
   * The construct scope.
   */
  private scope: Construct;

  /**
   * The construct identifier.
   */
  private id: string;

  /**
   * The EFS storage properties.
   */
  private props: Partial<EfsStorageProps> = {
    id: 'EFS_STORAGE'
  };

  /**
   * Sets the construct scope.
   * @param scope the construct scope.
   */
  public withScope(scope: Construct): EfsStorageBuilder {
    this.scope = scope;
    return (this);
  }

  /**
   * Sets the construct identifier.
   * @param id the construct identifier.
   */
  public withIdentifier(id: string): EfsStorageBuilder {
    this.id = id;
    return (this);
  }

  /**
   * Sets the VPC in which the EFS storage should be deployed.
   * @param vpc the VPC in which the EFS storage should be deployed.
   * @returns a reference to the builder.
   */
  public withVpc(vpc: ec2.IVpc): EfsStorageBuilder {
    this.props.vpc = vpc;
    return (this);
  }

  /**
   * Sets the path to the LanceDB dataset in the bucket.
   * @param path the path to the LanceDB dataset in the bucket.
   * @returns a reference to the builder.
   */
  public withPath(path: string): EfsStorageBuilder {
    this.props.path = path;
    return (this);
  }

  /**
   * Builds the EFS storage properties.
   * @returns a new instance of the `EfsStorage` class.
   */
  public build(): EfsStorage {
    return (EfsStorage.from(
      this.scope,
      this.id,
      this.props
    ));
  }
}

/**
 * The EFS storage.
 */
export class EfsStorage extends Construct implements LanceDbStorage {

  /**
   * The `EfsStorage` Builder.
   */
  public static Builder = EfsStorageBuilder;

  /**
   * The file system.
   */
  public fileSystem: efs.IFileSystem;

  /**
   * The access point.
   */
  public accessPoint: efs.IAccessPoint;

  /**
   * Creates a new instance of the `EfsStorage` class.
   * @param scope the construct scope.
   * @param resourceId the construct identifier.
   * @param props the task properties.
   */
  constructor(scope: Construct, resourceId: string, public props: EfsStorageProps) {
    super(scope, resourceId);
    
    // Create the file system.
    this.fileSystem = new efs.FileSystem(this, 'FileSystem', {
      vpc: this.props.vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      throughputMode: efs.ThroughputMode.ELASTIC,
      encrypted: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      }
    });

    // Create the access point.
    this.accessPoint = new efs.AccessPoint(this, 'AccessPoint', {
      fileSystem: this.fileSystem,
      path: '/lancedb',
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '750'
      },
      posixUser: {
        uid: '1000',
        gid: '1000'
      }
    });
  }

  /**
   * @returns the storage identifier.
   */
  public id(): string {
    return (this.props.id);
  }

  /**
   * @returns the VPC.
   */
  public vpc(): ec2.IVpc {
    return (this.props.vpc);
  }

  /**
   * @returns the storage path.
   */
  public path(): string {
    return (this.props.path);
  }

  /**
   * @returns the storage URI.
   */
  public uri(): string {
    return (path.join('/', 'mnt', 'efs', this.path()));
  }

  /**
   * Grants permissions to an `IGrantable`.
   * @param grantee the grantee to whom permissions should be granted.
   */
  grant(grantee: iam.IGrantable) {
    this.fileSystem.grantReadWrite(grantee);
  }

  /**
   * Creates a new instance of the `EfsStorage` class.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the storage properties.
   * @returns a new instance of the `EfsStorage` class.
   */
  public static from(scope: Construct, id: string, props: any) {
    return (new EfsStorage(scope, id, EfsStoragePropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the storage.
   */
  public toJSON() {
    return ({
      id: this.id(),
      path: this.path(),
      uri: this.uri()
    });
  }
}
