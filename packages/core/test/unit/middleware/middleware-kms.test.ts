import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CacheStorage } from '../../../src/cache-storage';
import { Middleware, MiddlewareProps, MiddlewareBuilder } from '../../../src/middleware';
import { Construct } from 'constructs';
import { ServiceDescription } from '../../../src/service';
import { ComputeType } from '../../../src/compute-type';

// The CDK application.
let app: cdk.App;

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'test-middleware',
  description: 'A test middleware.',
  version: '0.1.0',
  attrs: {}
};

/**
 * The builder for the `TestMiddleware` service.
 */
class TestMiddlewareBuilder extends MiddlewareBuilder {
  /**
   * @returns a new instance of the `TestMiddleware`
   * service constructed with the given parameters.
   */
  public build(): TestMiddleware {
    return (new TestMiddleware(
      this.scope,
      this.identifier, {
        ...this.props
      }
    ));
  }
}

class TestMiddleware extends Middleware {
  public static Builder = TestMiddlewareBuilder;

  constructor(scope: Construct, id: string, opts: MiddlewareProps) {
    super(scope, id, description, opts);
  }

  supportedInputTypes(): string[] {
    return (['application/pdf']);
  }

  supportedOutputTypes(): string[] {
    return (['text/plain']);
  }

  supportedComputeTypes(): ComputeType[] {
    return ([ComputeType.CPU]);
  }

  grantReadProcessedDocuments(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant {
    return ({} as cdk.aws_iam.Grant);
  }
}

/**
 * The test stack.
 */
class EncryptedTestStack extends cdk.Stack {
  public middleware: TestMiddleware;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The cache storage.
    const cacheStorage = new CacheStorage(this, 'CacheStorage');

    // Create a new KMS customer managed key.
    const key = new kms.Key(this, 'Key', {
      enableKeyRotation: true
    });

    // The middleware.
    this.middleware = new TestMiddleware.Builder()
      .withScope(this)
      .withIdentifier('TestMiddleware')
      .withCacheStorage(cacheStorage)
      .withKmsKey(key)
      .build();
  }
}

describe('Middleware API', () => {

  /**
   * A hook called back before each test case.
   */
  beforeEach(() => {
    app = new cdk.App();
  });

  /**
   * Input queue test.
   */
  test('should have created an encrypted input SQS queue', () => {
    const stack = new EncryptedTestStack(app, 'EncryptedTestStack');
    const template = Template.fromStack(stack);

    // SQS input queue.
    template.hasResourceProperties('AWS::SQS::Queue', {
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: {
          'Fn::GetAtt': [
            Match.anyValue(),
            'Arn'
          ]
        }
      }),
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'Context',
          Value: 'project-lakechain'
        })
      ]),
      KmsMasterKeyId: {
        'Fn::GetAtt': [
          Match.anyValue(),
          'Arn'
        ]
      }
    });
  });

  /**
   * Event bus test.
   */
  test('should have created an encrypted output event bus', () => {
    const stack = new EncryptedTestStack(app, 'EncryptedTestStack');
    const template = Template.fromStack(stack);

    // Event bus.
    template.hasResourceProperties('AWS::SNS::Topic', {
      KmsMasterKeyId: {
        'Fn::GetAtt': [
          Match.anyValue(),
          'Arn'
        ]
      },
      Tags: Match.arrayWith([
        Match.objectLike({
          Key: 'Context',
          Value: 'project-lakechain'
        })
      ])
    });
  });

  /**
   * Log group test.
   */
  test('should have created an encrypted log group', () => {
    const stack = new EncryptedTestStack(app, 'EncryptedTestStack');
    const template = Template.fromStack(stack);

    // Log group.
    template.hasResource('AWS::Logs::LogGroup', {
      Properties: {
        LogGroupName: Match.stringLikeRegexp('/lakechain/*'),
        KmsKeyId: {
          'Fn::GetAtt': [
            Match.anyValue(),
            'Arn'
          ]
        }
      },
      UpdateReplacePolicy: Match.exact('Delete'),
      DeletionPolicy: Match.exact('Delete')
    });

    // KMS Key policy.
    template.hasResource('AWS::KMS::Key', {
      Properties: {
        KeyPolicy: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: Match.exact('Allow'),
              Action: Match.arrayWith([
                'kms:Encrypt*',
                'kms:ReEncrypt*',
                'kms:Decrypt*',
                'kms:GenerateDataKey*',
                'kms:Describe*'
              ]),
              Principal: Match.objectLike({
                Service: Match.objectLike({
                  'Fn::Join': [
                    '',
                    [
                      'logs.',
                      {
                        Ref: 'AWS::Region'
                      },
                      '.',
                      {
                        Ref: 'AWS::URLSuffix'
                      }
                    ]
                  ]
                })
              }),
              Condition: {
                ArnLike: {
                  'kms:EncryptionContext:aws:logs:arn': Match.anyValue()
                }
              }
            })
          ])
        }
      }
    });
  });
});