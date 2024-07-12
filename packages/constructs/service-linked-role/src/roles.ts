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

import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as events from 'aws-cdk-lib/aws-events';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancing';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as config from 'aws-cdk-lib/aws-config';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as appmesh from 'aws-cdk-lib/aws-appmesh';
import * as securitylake from 'aws-cdk-lib/aws-securitylake';
import * as shield from 'aws-cdk-lib/aws-shield';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as timestream from 'aws-cdk-lib/aws-timestream';
import * as neptune from 'aws-cdk-lib/aws-neptune';
import * as mq from 'aws-cdk-lib/aws-amazonmq';
import * as memorydb from 'aws-cdk-lib/aws-memorydb';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as grafana from 'aws-cdk-lib/aws-grafana';
import * as iottwinmaker from 'aws-cdk-lib/aws-iottwinmaker';
import * as iotsitewise from 'aws-cdk-lib/aws-iotsitewise';
import * as ivs from 'aws-cdk-lib/aws-ivs';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';
import * as globalaccelerator from 'aws-cdk-lib/aws-globalaccelerator';
import * as finspace from 'aws-cdk-lib/aws-finspace';
import * as fis from 'aws-cdk-lib/aws-fis';
import * as emr from 'aws-cdk-lib/aws-emr';
import * as mediatailor from 'aws-cdk-lib/aws-mediatailor';
import * as mediapackage from 'aws-cdk-lib/aws-mediapackage';
import * as mediaconnect from 'aws-cdk-lib/aws-mediaconnect';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as imagebuilder from 'aws-cdk-lib/aws-imagebuilder';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as documentdb from 'aws-cdk-lib/aws-docdb';
import * as datasync from 'aws-cdk-lib/aws-datasync';
import * as dms from 'aws-cdk-lib/aws-dms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as batch from 'aws-cdk-lib/aws-batch';

/**
 * Friendly names identifying service linked roles.
 * These names can be used to enable auto completion in IDEs
 * f0r users to select the service they want to create a
 * service linked role for.
 */
export type Service = 'opensearch'
  | 'opensearch-serverless'
  | 'elasticsearch'
  | 'apigateway'
  | 'appsync'
  | 'cloudwatch-events'
  | 'ecs'
  | 'elb'
  | 'rds'
  | 'autoscaling'
  | 'backup'
  | 'config'
  | 'efs'
  | 'fsx'
  | 'ssm'
  | 's3-storage-lens'
  | 's3-outposts'
  | 'mgn'
  | 'appmesh'
  | 'security-lake'
  | 'service-catalog-sync'
  | 'shield'
  | 'ses'
  | 'wafv2'
  | 'timestream-influxdb'
  | 'panorama'
  | 'neptune'
  | 'mq'
  | 'memorydb-redis'
  | 'marketplace'
  | 'msk'
  | 'managed-grafana'
  | 'lambda-replicator'
  | 'autoscaling-cassandra'
  | 'kms-custom-key-store'
  | 'kms-multi-region-keys'
  | 'iot-twinmaker'
  | 'iot-sitewise'
  | 'ivs'
  | 'iam-roles-anywhere'
  | 'global-accelerator'
  | 'finspace'
  | 'fis'
  | 'emr-cleanup'
  | 'emr-wal'
  | 'emr-containers'
  | 'emr-serverless'
  | 'mediatailor'
  | 'mediapackage'
  | 'mediaconnect'
  | 'eks'
  | 'ecr-replication'
  | 'ecr-pullthrough-cache'
  | 'ecr-template'
  | 'elasticbeanstalk'
  | 'elasticbeanstalk-maintenance'
  | 'elasticbeanstalk-managed-updates'
  | 'elasticache'
  | 'ec2-instance-connect'
  | 'ec2-image-builder'
  | 'dynamodb-dax'
  | 'documentdb-elastic-clusters'
  | 'datasync'
  | 'dms-fleet-advisor'
  | 'dms-serverless'
  | 'cognito-email'
  | 'cloudhsm'
  | 'aws-chatbot'
  | 'acm'
  | 'batch';

/**
 * The properties of a service linked role.
 */
type ServiceLinkedRoleProps = {
  service: string;
  name: string;
  description: string;
  dependents?: any[];
}

/**
 * A mapping between service linked role friendly names, and their
 * properties used to determine the name of the service linked role,
 * the service it is linked to, and a description of the service linked role.
 */
export const ROLE_MAP: Record<Service, ServiceLinkedRoleProps> = {
  'opensearch': {
    service: 'opensearchservice.amazonaws.com',
    name: 'AWSServiceRoleForAmazonOpenSearchService',
    description: 'Service linked role for OpenSearch Service',
    dependents: [
      opensearch.CfnDomain
    ]
  },
  'opensearch-serverless': {
    service: 'observability.aoss.amazonaws.com',
    name: 'AWSServiceRoleForAmazonOpenSearchServerless',
    description: 'Service linked role for OpenSearch Serverless',
    dependents: [
      opensearchserverless.CfnCollection
    ]
  },
  'elasticsearch': {
    service: 'es.amazonaws.com',
    name: 'AWSServiceRoleForAmazonElasticsearchService',
    description: 'Service linked role for Elasticsearch Service',
    dependents: [
      opensearch.CfnDomain
    ]
  },
  'apigateway': {
    service: 'ops.apigateway.amazonaws.com',
    name: 'AWSServiceRoleForAPIGateway',
    description: 'Service linked role for API Gateway',
    dependents: [
      apigateway.CfnRestApi
    ]
  },
  'appsync': {
    service: 'appsync.amazonaws.com',
    name: 'AWSServiceRoleForAppSync',
    description: 'Service linked role for AppSync',
    dependents: [
      appsync.CfnGraphQLApi
    ]
  },
  'cloudwatch-events': {
    service: 'events.amazonaws.com',
    name: 'AWSServiceRoleForCloudWatchEvents',
    description: 'Service linked role for CloudWatch Events',
    dependents: [
      events.CfnRule,
      events.CfnEventBus,
      events.CfnArchive,
      events.CfnEventBusPolicy,
      events.CfnConnection
    ]
  },
  'ecs': {
    service: 'ecs.amazonaws.com',
    name: 'AWSServiceRoleForECS',
    description: 'Service linked role for ECS',
    dependents: [
      ecs.CfnCluster,
      ecs.CfnTaskDefinition,
      ecs.CfnService
    ]
  },
  'elb': {
    service: 'elasticloadbalancing.amazonaws.com',
    name: 'AWSServiceRoleForElasticLoadBalancing',
    description: 'Service linked role for Elastic Load Balancing',
    dependents: [
      elb.CfnLoadBalancer
    ]
  },
  'rds': {
    service: 'rds.amazonaws.com',
    name: 'AWSServiceRoleForRDS',
    description: 'Service linked role for Amazon RDS',
    dependents: [
      rds.CfnDBInstance,
      rds.CfnDBCluster,
      rds.CfnDBProxy,
      rds.CfnDBSecurityGroup,
      rds.CfnDBSubnetGroup,
      rds.CfnDBParameterGroup,
      rds.CfnDBClusterParameterGroup
    ]
  },
  'autoscaling': {
    service: 'autoscaling.amazonaws.com',
    name: 'AWSServiceRoleForAutoScaling',
    description: 'Service linked role for Auto Scaling',
    dependents: [
      autoscaling.CfnAutoScalingGroup,
      autoscaling.CfnLaunchConfiguration,
      autoscaling.CfnScalingPolicy,
      autoscaling.CfnScheduledAction,
      autoscaling.CfnLifecycleHook
    ]
  },
  'backup': {
    service: 'backup.amazonaws.com',
    name: 'AWSServiceRoleForBackup',
    description: 'Service linked role for Backup',
    dependents: [
      backup.CfnBackupPlan,
      backup.CfnBackupSelection,
      backup.CfnBackupVault,
      backup.CfnFramework,
      backup.CfnReportPlan
    ]
  },
  'config': {
    service: 'config.amazonaws.com',
    name: 'AWSServiceRoleForConfig',
    description: 'Service linked role for Config',
    dependents: [
      config.CfnAggregationAuthorization,
      config.CfnConfigRule,
      config.CfnConfigurationAggregator,
      config.CfnConfigurationRecorder,
      config.CfnConformancePack,
      config.CfnDeliveryChannel,
      config.CfnOrganizationConfigRule,
      config.CfnOrganizationConformancePack,
      config.CfnRemediationConfiguration
    ]
  },
  'efs': {
    service: 'elasticfilesystem.amazonaws.com',
    name: 'AWSServiceRoleForAmazonElasticFileSystem',
    description: 'Service linked role for EFS',
    dependents: [
      efs.CfnFileSystem
    ]
  },
  'fsx': {
    service: 'fsx.amazonaws.com',
    name: 'AWSServiceRoleForAmazonFSx',
    description: 'Service linked role for FSx',
    dependents: [
      fsx.CfnFileSystem
    ]
  },
  'ssm': {
    service: 'ssm.amazonaws.com',
    name: 'AWSServiceRoleForAmazonSSM',
    description: 'Service linked role for SSM',
    dependents: [
      ssm.CfnAssociation,
      ssm.CfnDocument,
      ssm.CfnMaintenanceWindow,
      ssm.CfnParameter,
      ssm.CfnPatchBaseline,
      ssm.CfnResourceDataSync,
      ssm.CfnResourcePolicy
    ]
  },
  's3-storage-lens': {
    service: 'storage-lens.s3.amazonaws.com',
    name: 'AWSServiceRoleForS3StorageLens',
    description: 'Service linked role for S3 Storage Lens',
    dependents: []
  },
  's3-outposts': {
    service: 's3-outposts.amazonaws.com',
    name: 'AWSServiceRoleForS3OnOutposts',
    description: 'Service linked role for S3 on Outposts',
    dependents: []
  },
  'mgn': {
    service: 'mgn.amazonaws.com',
    name: 'AWSServiceRoleForApplicationMigrationService',
    description: 'Service linked role for Application Migration Service',
    dependents: []
  },
  'appmesh': {
    service: 'appmesh.amazonaws.com',
    name: 'AWSServiceRoleForAppMesh',
    description: 'Service linked role for App Mesh',
    dependents: [
      appmesh.CfnMesh,
      appmesh.CfnVirtualNode,
      appmesh.CfnVirtualRouter,
      appmesh.CfnGatewayRoute,
      appmesh.CfnRoute,
      appmesh.CfnVirtualGateway,
      appmesh.CfnVirtualService
    ]
  },
  'security-lake': {
    service: 'securitylake.amazonaws.com',
    name: 'AWSServiceRoleForSecurityLake',
    description: 'Service linked role for Security Lake',
    dependents: [
      securitylake.CfnAwsLogSource,
      securitylake.CfnDataLake,
      securitylake.CfnSubscriber,
      securitylake.CfnSubscriberNotification
    ]
  },
  'service-catalog-sync': {
    service: 'sync.servicecatalog.amazonaws.com',
    name: 'AWSServiceRoleForServiceCatalogSync',
    description: 'Service linked role for Service Catalog Sync',
    dependents: []
  },
  'shield': {
    service: 'shield.amazonaws.com',
    name: 'AWSServiceRoleForAWSShield',
    description: 'Service linked role for AWS Shield',
    dependents: [
      shield.CfnProtection,
      shield.CfnProtectionGroup,
      shield.CfnDRTAccess,
      shield.CfnProactiveEngagement
    ]
  },
  'ses': {
    service: 'ses.amazonaws.com',
    name: 'AWSServiceRoleForAmazonSES',
    description: 'Service linked role for Amazon SES',
    dependents: [
      ses.CfnConfigurationSet,
      ses.CfnConfigurationSetEventDestination,
      ses.CfnReceiptFilter,
      ses.CfnReceiptRule,
      ses.CfnReceiptRuleSet,
      ses.CfnTemplate
    ]
  },
  'wafv2': {
    service: 'wafv2.amazonaws.com',
    name: 'AWSServiceRoleForWAFV2Logging',
    description: 'Service linked role for WAFV2',
    dependents: [
      wafv2.CfnWebACL,
      wafv2.CfnRuleGroup,
      wafv2.CfnIPSet,
      wafv2.CfnRegexPatternSet,
      wafv2.CfnLoggingConfiguration,
      wafv2.CfnWebACLAssociation
    ]
  },
  'timestream-influxdb': {
    service: 'timestream-influxdb.amazonaws.com',
    name: 'AWSServiceRoleForTimestreamInfluxDB',
    description: 'Service linked role for Timestream InfluxDB',
    dependents: [
      timestream.CfnInfluxDBInstance
    ]
  },
  'panorama': {
    service: 'panorama.amazonaws.com',
    name: 'AWSServiceRoleForAWSPanorama',
    description: 'Service linked role for AWS Panorama',
    dependents: []
  },
  'neptune': {
    service: 'rds.amazonaws.com',
    name: 'AWSServiceRoleForRDS',
    description: 'Service linked role for Amazon RDS',
    dependents: [
      neptune.CfnDBInstance,
      neptune.CfnDBCluster,
      neptune.CfnDBSubnetGroup,
      neptune.CfnDBParameterGroup,
      neptune.CfnDBClusterParameterGroup,
      neptune.CfnEventSubscription
    ]
  },
  'mq': {
    service: 'mq.amazonaws.com',
    name: 'AWSServiceRoleForAmazonMQ',
    description: 'Service linked role for Amazon MQ',
    dependents: [
      mq.CfnBroker,
      mq.CfnConfiguration,
      mq.CfnConfigurationAssociation
    ]
  },
  'memorydb-redis': {
    service: 'memorydb.amazonaws.com',
    name: 'AWSServiceRoleForMemoryDB',
    description: 'Service linked role for MemoryDB',
    dependents: [
      memorydb.CfnCluster,
      memorydb.CfnACL,
      memorydb.CfnParameterGroup,
      memorydb.CfnSubnetGroup,
      memorydb.CfnUser
    ]
  },
  'marketplace': {
    service: 'license-management.marketplace.amazonaws.com',
    name: 'AWSServiceRoleForMarketplaceLicenseManagement',
    description: 'Service linked role for AWS Marketplace',
    dependents: []
  },
  'msk': {
    service: 'kafka.amazonaws.com',
    name: 'AWSServiceRoleForKafka',
    description: 'Service linked role for Amazon MSK',
    dependents: [
      msk.CfnCluster,
      msk.CfnBatchScramSecret,
      msk.CfnConfiguration,
      msk.CfnClusterPolicy,
      msk.CfnReplicator,
      msk.CfnServerlessCluster,
      msk.CfnVpcConnection
    ]
  },
  'managed-grafana': {
    service: 'grafana.amazonaws.com',
    name: 'AWSServiceRoleForAmazonGrafana',
    description: 'Service linked role for Amazon Managed Grafana',
    dependents: [
      grafana.CfnWorkspace
    ]
  },
  'lambda-replicator': {
    service: 'replicator.lambda.amazonaws.com',
    name: 'AWSServiceRoleForLambdaReplicator',
    description: 'Service linked role for Lambda Replicator',
    dependents: []
  },
  'autoscaling-cassandra': {
    service: 'cassandra.application-autoscaling.amazonaws.com',
    name: 'AWSServiceRoleForApplicationAutoScaling_CassandraTable',
    description: 'Service linked role for Auto Scaling Cassandra',
    dependents: []
  },
  'kms-custom-key-store': {
    service: 'cks.kms.amazonaws.com',
    name: 'AWSServiceRoleForKeyManagementServiceCustomKeyStores',
    description: 'Service linked role for KMS Custom Key Store',
    dependents: []
  },
  'kms-multi-region-keys': {
    service: 'mrk.kms.amazonaws.com',
    name: 'AWSServiceRoleForKeyManagementServiceMultiRegionKeys',
    description: 'Service linked role for KMS Multi-Region Keys',
    dependents: []
  },
  'iot-twinmaker': {
    service: 'iottwinmaker.amazonaws.com',
    name: 'AWSServiceRoleForIoTTwinMaker',
    description: 'Service linked role for IoT TwinMaker',
    dependents: [
      iottwinmaker.CfnComponentType,
      iottwinmaker.CfnEntity,
      iottwinmaker.CfnScene,
      iottwinmaker.CfnSyncJob,
      iottwinmaker.CfnWorkspace
    ]
  },
  'iot-sitewise': {
    service: 'iotsitewise.amazonaws.com',
    name: 'AWSServiceRoleForIoTSiteWise',
    description: 'Service linked role for IoT SiteWise',
    dependents: [
      iotsitewise.CfnAccessPolicy,
      iotsitewise.CfnAsset,
      iotsitewise.CfnAssetModel,
      iotsitewise.CfnGateway,
      iotsitewise.CfnPortal,
      iotsitewise.CfnProject,
      iotsitewise.CfnDashboard
    ]
  },
  'ivs': {
    service: 'ivs.amazonaws.com',
    name: 'AWSServiceRoleForIVSRecordToS3',
    description: 'Service linked role for Interactive Video Service',
    dependents: [
      ivs.CfnChannel,
      ivs.CfnPlaybackKeyPair,
      ivs.CfnEncoderConfiguration,
      ivs.CfnStreamKey,
      ivs.CfnRecordingConfiguration,
      ivs.CfnPlaybackRestrictionPolicy,
      ivs.CfnStage,
      ivs.CfnStorageConfiguration
    ]
  },
  'iam-roles-anywhere': {
    service: 'rolesanywhere.amazonaws.com',
    name: 'AWSServiceRoleForRolesAnywhere',
    description: 'Service linked role for IAM Roles Anywhere',
    dependents: [
      rolesanywhere.CfnCRL,
      rolesanywhere.CfnProfile,
      rolesanywhere.CfnTrustAnchor
    ]
  },
  'global-accelerator': {
    service: 'globalaccelerator.amazonaws.com',
    name: 'AWSServiceRoleForGlobalAccelerator',
    description: 'Service linked role for Global Accelerator',
    dependents: [
      globalaccelerator.CfnAccelerator,
      globalaccelerator.CfnListener,
      globalaccelerator.CfnEndpointGroup,
      globalaccelerator.CfnCrossAccountAttachment
    ]
  },
  'finspace': {
    service: 'finspace.amazonaws.com',
    name: 'AWSServiceRoleForFinSpace',
    description: 'Service linked role for FinSpace',
    dependents: [
      finspace.CfnEnvironment
    ]
  },
  'fis': {
    service: 'fis.amazonaws.com',
    name: 'AWSServiceRoleForFIS',
    description: 'Service linked role for FIS',
    dependents: [
      fis.CfnExperimentTemplate,
      fis.CfnTargetAccountConfiguration
    ]
  },
  'emr-cleanup': {
    service: 'elasticmapreduce.amazonaws.com',
    name: 'AWSServiceRoleForEMRCleanup',
    description: 'Service linked role for EMR Cleanup',
    dependents: [
      emr.CfnCluster
    ]
  },
  'emr-wal': {
    service: 'emrwal.amazonaws.com',
    name: 'AWSServiceRoleForEMRWAL',
    description: 'Service linked role for EMR WAL',
    dependents: [
      emr.CfnWALWorkspace
    ]
  },
  'emr-containers': {
    service: 'emr-containers.amazonaws.com',
    name: 'AWSServiceRoleForAmazonEMRContainers',
    description: 'Service linked role for Amazon EMR Containers',
    dependents: [
      emr.CfnCluster
    ]
  },
  'emr-serverless': {
    service: 'ops.emr-serverless.amazonaws.com',
    name: 'AWSServiceRoleForAmazonEMRServerless',
    description: 'Service linked role for Amazon EMR Serverless',
    dependents: [
      emr.CfnCluster
    ]
  },
  'mediatailor': {
    service: 'mediatailor.amazonaws.com',
    name: 'AWSServiceRoleForMediaTailor',
    description: 'Service linked role for MediaTailor',
    dependents: [
      mediatailor.CfnChannel,
      mediatailor.CfnChannelPolicy,
      mediatailor.CfnPlaybackConfiguration,
      mediatailor.CfnSourceLocation,
      mediatailor.CfnLiveSource,
      mediatailor.CfnVodSource
    ]
  },
  'mediapackage': {
    service: 'mediapackage.amazonaws.com',
    name: 'AWSServiceRoleForMediaPackage',
    description: 'Service linked role for MediaPackage',
    dependents: [
      mediapackage.CfnChannel,
      mediapackage.CfnOriginEndpoint,
      mediapackage.CfnAsset,
      mediapackage.CfnPackagingConfiguration,
      mediapackage.CfnPackagingGroup
    ]
  },
  'mediaconnect': {
    service: 'mediaconnect.amazonaws.com',
    name: 'AWSServiceRoleForMediaConnect',
    description: 'Service linked role for MediaConnect',
    dependents: [
      mediaconnect.CfnFlow,
      mediaconnect.CfnFlowEntitlement,
      mediaconnect.CfnFlowOutput,
      mediaconnect.CfnFlowSource,
      mediaconnect.CfnFlowVpcInterface,
      mediaconnect.CfnBridge,
      mediaconnect.CfnBridgeOutput,
      mediaconnect.CfnBridgeSource,
      mediaconnect.CfnGateway
    ]
  },
  'eks': {
    service: 'eks.amazonaws.com',
    name: 'AWSServiceRoleForAmazonEKS',
    description: 'Service linked role for EKS',
    dependents: [
      eks.CfnCluster,
      eks.CfnAccessEntry,
      eks.CfnAddon,
      eks.CfnFargateProfile,
      eks.CfnIdentityProviderConfig,
      eks.CfnNodegroup,
      eks.CfnPodIdentityAssociation
    ]
  },
  'ecr-replication': {
    service: 'replication.ecr.amazonaws.com',
    name: 'AWSServiceRoleForECRReplication',
    description: 'Service linked role for ECR Replication',
    dependents: [
      ecr.CfnRepository,
      ecr.CfnPublicRepository,
      ecr.CfnReplicationConfiguration
    ]
  },
  'ecr-pullthrough-cache': {
    service: 'pullthroughcache.ecr.amazonaws.com',
    name: 'AWSServiceRoleForECRPullThroughCache',
    description: 'Service linked role for ECR Pull Through Cache',
    dependents: [
      ecr.CfnRepository,
      ecr.CfnPublicRepository,
      ecr.CfnPullThroughCacheRule
    ]
  },
  'ecr-template': {
    service: 'ecr.amazonaws.com',
    name: 'AWSServiceRoleForECRTemplate',
    description: 'Service linked role for ECR Template',
    dependents: [
      ecr.CfnRepository
    ]
  },
  'elasticbeanstalk': {
    service: 'elasticbeanstalk.amazonaws.com',
    name: 'AWSServiceRoleForElasticBeanstalk',
    description: 'Service linked role for Elastic Beanstalk',
    dependents: [
      elasticbeanstalk.CfnApplication,
      elasticbeanstalk.CfnApplicationVersion,
      elasticbeanstalk.CfnConfigurationTemplate,
      elasticbeanstalk.CfnEnvironment
    ]
  },
  'elasticbeanstalk-maintenance': {
    service: 'maintenance.elasticbeanstalk.amazonaws.com',
    name: 'AWSServiceRoleForElasticBeanstalkMaintenance',
    description: 'Service linked role for Elastic Beanstalk Maintenance',
    dependents: [
      elasticbeanstalk.CfnApplication,
      elasticbeanstalk.CfnApplicationVersion,
      elasticbeanstalk.CfnConfigurationTemplate,
      elasticbeanstalk.CfnEnvironment
    ]
  },
  'elasticbeanstalk-managed-updates': {
    service: 'managedupdates.elasticbeanstalk.amazonaws.com',
    name: 'AWSServiceRoleForElasticBeanstalkManagedUpdates',
    description: 'Service linked role for Elastic Beanstalk Managed Updates',
    dependents: [
      elasticbeanstalk.CfnApplication,
      elasticbeanstalk.CfnApplicationVersion,
      elasticbeanstalk.CfnConfigurationTemplate,
      elasticbeanstalk.CfnEnvironment
    ]
  },
  'elasticache': {
    service: 'elasticache.amazonaws.com',
    name: 'AWSServiceRoleForElastiCache',
    description: 'Service linked role for ElastiCache',
    dependents: [
      elasticache.CfnCacheCluster,
      elasticache.CfnReplicationGroup,
      elasticache.CfnUser,
      elasticache.CfnUserGroup,
      elasticache.CfnSubnetGroup,
      elasticache.CfnSecurityGroup,
      elasticache.CfnParameterGroup,
      elasticache.CfnGlobalReplicationGroup,
      elasticache.CfnSecurityGroupIngress,
      elasticache.CfnServerlessCache
    ]
  },
  'ec2-instance-connect': {
    service: 'ec2-instance-connect.amazonaws.com',
    name: 'AWSServiceRoleForEC2InstanceConnect',
    description: 'Service linked role for EC2 Instance Connect',
    dependents: []
  },
  'ec2-image-builder': {
    service: 'imagebuilder.amazonaws.com',
    name: 'AWSServiceRoleForImageBuilder',
    description: 'Service linked role for EC2 Image Builder',
    dependents: [
      imagebuilder.CfnComponent,
      imagebuilder.CfnDistributionConfiguration,
      imagebuilder.CfnImage,
      imagebuilder.CfnImagePipeline,
      imagebuilder.CfnImageRecipe,
      imagebuilder.CfnInfrastructureConfiguration,
      imagebuilder.CfnContainerRecipe,
      imagebuilder.CfnLifecyclePolicy,
      imagebuilder.CfnWorkflow
    ]
  },
  'dynamodb-dax': {
    service: 'dax.amazonaws.com',
    name: 'AWSServiceRoleForDAX',
    description: 'Service linked role for DAX',
    dependents: [
      dynamodb.CfnTable,
      dynamodb.CfnGlobalTable
    ]
  },
  'documentdb-elastic-clusters': {
    service: 'docdb-elastic.amazonaws.com',
    name: 'AWSServiceRoleForDocDB-Elastic',
    description: 'Service linked role for DocumentDB',
    dependents: [
      documentdb.CfnDBCluster,
      documentdb.CfnDBInstance
    ]
  },
  'datasync': {
    service: 'discovery-datasync.amazonaws.com',
    name: 'AWSServiceRoleForDataSyncDiscovery',
    description: 'Service linked role for DataSync',
    dependents: [
      datasync.CfnAgent,
      datasync.CfnTask,
      datasync.CfnLocationAzureBlob,
      datasync.CfnLocationSMB,
      datasync.CfnLocationS3,
      datasync.CfnLocationEFS,
      datasync.CfnLocationNFS,
      datasync.CfnLocationFSxWindows,
      datasync.CfnLocationHDFS,
      datasync.CfnLocationObjectStorage,
      datasync.CfnLocationFSxONTAP,
      datasync.CfnLocationFSxLustre,
      datasync.CfnLocationFSxOpenZFS,
      datasync.CfnStorageSystem
    ]
  },
  'dms-fleet-advisor': {
    service: 'dms-fleet-advisor.amazonaws.com',
    name: 'AWSServiceRoleForDMSFleetAdvisor',
    description: 'Service linked role for DMS Fleet Advisor',
    dependents: []
  },
  'dms-serverless': {
    service: 'dms.amazonaws.com',
    name: 'AWSServiceRoleForDMSServerless',
    description: 'Service linked role for DMS Serverless',
    dependents: [
      dms.CfnCertificate,
      dms.CfnEndpoint,
      dms.CfnEventSubscription,
      dms.CfnReplicationInstance,
      dms.CfnReplicationSubnetGroup,
      dms.CfnReplicationTask,
      dms.CfnReplicationConfig,
      dms.CfnDataProvider,
      dms.CfnInstanceProfile,
      dms.CfnMigrationProject
    ]
  },
  'cognito-email': {
    service: 'email.cognito-idp.amazonaws.com',
    name: 'AWSServiceRoleForAmazonCognitoIdpEmailService',
    description: 'Service linked role for Cognito Email',
    dependents: [
      cognito.CfnUserPool,
      cognito.CfnUserPoolClient,
      cognito.CfnUserPoolDomain
    ]
  },
  'cloudhsm': {
    service: 'cloudhsm.amazonaws.com',
    name: 'AWSServiceRoleForCloudHSM',
    description: 'Service linked role for CloudHSM'
  },
  'aws-chatbot': {
    service: 'management.chatbot.amazonaws.com',
    name: 'AWSServiceRoleForAWSChatbot',
    description: 'Service linked role for AWS Chatbot',
    dependents: [
      chatbot.CfnSlackChannelConfiguration,
      chatbot.CfnMicrosoftTeamsChannelConfiguration
    ]
  },
  'acm': {
    service: 'acm.amazonaws.com',
    name: 'AWSServiceRoleForCertificateManager',
    description: 'Service linked role for Amazon Certificate Manager',
    dependents: [
      acm.CfnAccount,
      acm.CfnCertificate
    ]
  },
  'batch': {
    service: 'batch.amazonaws.com',
    name: 'AWSServiceRoleForBatch',
    description: 'Service linked role for AWS Batch',
    dependents: [
      batch.CfnComputeEnvironment,
      batch.CfnJobDefinition,
      batch.CfnJobQueue,
      batch.CfnSchedulingPolicy
    ]
  }
} as const;
