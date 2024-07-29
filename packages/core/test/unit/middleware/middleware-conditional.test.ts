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
 * The builder for the `DefaultTestMiddleware` service.
 */
class DefaultMiddlewareBuilder extends MiddlewareBuilder {
  
  /**
   * @returns a new instance of the `TestMiddleware`
   * service constructed with the given parameters.
   */
  public build(): Middleware {
    return (new DefaultTestMiddleware(
      this.scope,
      this.identifier, {
        ...this.props
      }
    ));
  }
}

class DefaultTestMiddleware extends Middleware {
  public static readonly Builder = DefaultMiddlewareBuilder;

  constructor(scope: Construct, id: string, opts: MiddlewareProps) {
    super(scope, id, description, opts);
  }

  supportedInputTypes(): string[] {
    return ([
      'application/pdf',
      'application/json',
      'text/plain'
    ]);
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
 * The custom test stack.
 */
class PlaceholderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

describe('Middleware Conditional', () => {

  /**
   * A hook called back before each test case.
   */
  beforeEach(() => {
    app = new cdk.App();
  });

  /**
   * By default, the middleware conditional should filter
   * the document type to the supported input types.
   */
  test('should have a default value', () => {
    const stack = new PlaceholderStack(app, 'DefaultTestStack');

    // The cache storage.
    const cacheStorage = new CacheStorage(stack, 'CacheStorage');

    // The producer middleware.
    const producer = new DefaultTestMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('Producer')
      .withCacheStorage(cacheStorage)
      .build();

    // The consumer middleware.
    const consumer = new DefaultTestMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('Consumer')
      .withCacheStorage(cacheStorage)
      .build();

    // Connect the consumer to the producer.
    producer.pipe(consumer);
    
    // Expect the default conditional to be set.
    expect(producer.conditional().value()).toEqual({
      data: {
        document: {
          type: [
            'application/pdf',
            'application/json',
            'text/plain'
          ]
        }
      }
    });

    // Expect the SNS subscription to have the filter policy.
    Template.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'sqs',
      FilterPolicyScope: 'MessageBody',
      FilterPolicy: {
        data: {
          document: {
            type: Match.arrayWith(['application/pdf', 'application/json', 'text/plain'])
          }
        }
      }
    });
  });
});