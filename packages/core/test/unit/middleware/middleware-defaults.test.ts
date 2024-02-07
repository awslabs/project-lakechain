import * as cdk from 'aws-cdk-lib';
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
 * Expected tags.
 */
const expectedTags = Match.arrayWith([
  Match.objectLike({
    Key: 'Context',
    Value: 'project-lakechain'
  }), Match.objectLike({
    Key: 'Service',
    Value: 'test-middleware'
  }), Match.objectLike({
    Key: 'Version',
    Value: '0.1.0'
  })
]);

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
class SimpleTestStack extends cdk.Stack {
  public middleware: TestMiddleware;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The cache storage.
    const cacheStorage = new CacheStorage(this, 'CacheStorage');

    // The middleware.
    this.middleware = new TestMiddleware.Builder()
      .withScope(this)
      .withIdentifier('TestMiddleware')
      .withCacheStorage(cacheStorage)
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

  test('should be able to create a middleware with sane defaults', () => {
    const stack = new SimpleTestStack(app, 'SimpleTestStack');
    
    expect(stack.middleware.getConsumers().size).toBe(0);
    expect(stack.middleware.getSources().size).toBe(0);
    expect(stack.middleware.getEventBus()).not.toBeUndefined();
    expect(stack.middleware.getDeadLetterQueue()).not.toBeNull();
    expect(stack.middleware.getQueue()).not.toBeNull();
    expect(stack.middleware.supportedInputTypes()).toEqual(['application/pdf']);
    expect(stack.middleware.supportedOutputTypes()).toEqual(['text/plain']);
    expect(stack.middleware.supportedComputeTypes()).toEqual([ComputeType.CPU]);
  });

  /**
   * Input queue test.
   */
  test('should have created an input SQS queue', () => {
    const stack = new SimpleTestStack(app, 'SimpleTestStack');
    const template = Template.fromStack(stack);

    // SQS input queue.
    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: Match.exact(1209600),
      KmsMasterKeyId: Match.absent(),
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: {
          'Fn::GetAtt': [
            Match.anyValue(),
            'Arn'
          ]
        }
      }),
      Tags: expectedTags,
      SqsManagedSseEnabled: Match.exact(true)
    });

    // SQS queue policy assertion.
    template.hasResourceProperties('AWS::SQS::QueuePolicy', {
      Queues: Match.arrayWith([{
        Ref: Match.anyValue()
      }]),
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({
          Effect: 'Deny',
          Action: 'sqs:*',
          Principal: {
            AWS: '*'
          },
          Condition: {
            Bool: { 'aws:SecureTransport': 'false' },
          }
        })])
      })
    });
  });

  /**
   * Event bus test.
   */
  test('should have created an output event bus', () => {
    const stack = new SimpleTestStack(app, 'SimpleTestStack');
    const template = Template.fromStack(stack);

    // Event bus.
    template.hasResourceProperties('AWS::SNS::Topic', {
      KmsMasterKeyId: Match.absent(),
      Tags: expectedTags
    });
  });

  /**
   * Log group test.
   */
  test('should have created a log group', () => {
    const stack = new SimpleTestStack(app, 'SimpleTestStack');
    const template = Template.fromStack(stack);

    // Log group.
    template.hasResource('AWS::Logs::LogGroup', {
      KmsKeyId: Match.absent(),
      UpdateReplacePolicy: Match.exact('Delete'),
      DeletionPolicy: Match.exact('Delete')
    });
  });

  /**
   * SSM parameter test.
   */
  test('should have created the required SSM parameters', () => {
    const stack = new SimpleTestStack(app, 'SimpleTestStack');
    const template = Template.fromStack(stack);

    // Middleware description parameter.
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: Match.stringLikeRegexp('/services/.*/test-middleware/0.1.0/description'),
      Type: Match.exact('String')
    });

    // Input queue URL parameter.
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: Match.stringLikeRegexp('/services/.*/test-middleware/0.1.0/input-queue/url'),
      Type: Match.exact('String')
    });
    
    // Event bus ARN parameter.
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: Match.stringLikeRegexp('/services/.*/test-middleware/0.1.0/event-bus/arn'),
      Type: Match.exact('String')
    });

    // Log group name parameter.
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: Match.stringLikeRegexp('/services/.*/test-middleware/0.1.0/log-group/name'),
      Type: Match.exact('String')
    });
  });
});