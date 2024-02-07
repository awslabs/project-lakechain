import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CacheStorage, CacheStorageProps } from '../../src/cache-storage';

// The CDK application.
let app: cdk.App;

/**
 * Test stack properties.
 */
type StackProps = CacheStorageProps & { createKey?: boolean};

/**
 * Test stack.
 */
class TestStack extends cdk.Stack {
  public cacheStorage: CacheStorage;

  constructor(scope: cdk.App, id: string, opts: StackProps = { createKey: false }) {
    super(scope, id);
    this.cacheStorage = new CacheStorage(this, 'Storage', opts.createKey ? {
      encryptionKey: new kms.Key(this, 'Key', {
        enableKeyRotation: true
      }), ...opts
    } : opts);
  }
}

describe('Cache Storage', () => {

  /**
   * A hook called back before each test case.
   */
  beforeEach(() => {
    app = new cdk.App();
  });

  /**
   * Default cache storage instantiation test.
   */
  test('should be able to create a cache storage with sane defaults', () => {
    const stack = new TestStack(app, 'TestStack');
    const template = Template.fromStack(stack);
    
    // S3 bucket properties assertion.
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: [
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({
              SSEAlgorithm: 'AES256'
            })
          })
        ]
      }),
      LifecycleConfiguration: Match.objectLike({
        Rules: [
          Match.objectLike({
            ExpirationInDays: 1,
            AbortIncompleteMultipartUpload: Match.objectLike({
              DaysAfterInitiation: 1
            })
          })
        ]
      }),
      PublicAccessBlockConfiguration: Match.objectLike({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      })
    });

    // Deletion policy assertion.
    template.hasResource('AWS::S3::Bucket', {
      UpdateReplacePolicy: Match.exact('Delete'),
      DeletionPolicy: Match.exact('Delete')
    });

    // S3 bucket policy assertion.
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      Bucket: Match.anyValue(),
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({
          Effect: 'Deny',
          Condition: {
            Bool: { 'aws:SecureTransport': 'false' },
          }
        })])
      })
    });
  });

  /**
   * Removal policy test.
   */
  test('should be able to create a cache storage with a custom removal policy', () => {
    const stack = new TestStack(app, 'TestStack', {
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });
    const template = Template.fromStack(stack);

    // Deletion policy assertion.
    template.hasResource('AWS::S3::Bucket', {
      UpdateReplacePolicy: Match.exact('Retain'),
      DeletionPolicy: Match.exact('Retain')
    });
  });

  /**
   * Encryption test.
   */
  test('should be able to create a cache storage with a custom encryption key', () => {
    const stack = new TestStack(app, 'TestStack', {
      createKey: true
    });
    const template = Template.fromStack(stack);

    // S3 bucket properties assertion.
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: [
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({
              KMSMasterKeyID: Match.not(Match.absent()),
            })
          })
        ]
      })
    });
  });
});