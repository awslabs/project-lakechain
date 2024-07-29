import * as cdk from 'aws-cdk-lib';
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
 * The builder for the `ProducerMiddleware` service.
 */
class ProducerMiddlewareBuilder extends MiddlewareBuilder {
  /**
   * @returns a new instance of the `ProducerMiddleware`
   * service constructed with the given parameters.
   */
  public build(): ProducerMiddleware {
    return (new ProducerMiddleware(
      this.scope,
      this.identifier, {
        ...this.props
      }
    ));
  }
}

class ProducerMiddleware extends Middleware {
  public static readonly Builder = ProducerMiddlewareBuilder;

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
 * The builder for the `ConsumerMiddleware` service.
 */
class ConsumerMiddlewareBuilder extends MiddlewareBuilder {
  /**
   * @returns a new instance of the `ConsumerMiddleware`
   * service constructed with the given parameters.
   */
  public build(): ConsumerMiddleware {
    return (new ConsumerMiddleware(
      this.scope,
      this.identifier, {
        ...this.props
      }
    ));
  }
}

class ConsumerMiddleware extends Middleware {
  public static Builder = ConsumerMiddlewareBuilder;

  constructor(scope: Construct, id: string, opts: MiddlewareProps) {
    super(scope, id, description, opts);
  }

  supportedInputTypes(): string[] {
    return (['text/plain']);
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

class PlaceholderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

describe('Middleware Connections', () => {

  /**
   * A hook called back before each test case.
   */
  beforeEach(() => {
    app = new cdk.App();
  });

  /**
   * Simple middleware connection.
   */
  test('should be able to create a middleware connected to a consumer', () => {
    const stack = new PlaceholderStack(app, 'PlaceholderStack');
    
    // The cache storage.
    const cacheStorage = new CacheStorage(stack, 'CacheStorage');

    // The producer middleware.
    const producer = new ProducerMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('ProducerMiddleware')
      .withCacheStorage(cacheStorage)
      .build();

    // The consumer middleware.
    const consumer = new ConsumerMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('ConsumerMiddleware')
      .withCacheStorage(cacheStorage)
      .build();

    // Connect the consumer to the producer.
    producer.pipe(consumer);
    
    // Producer.
    expect(producer.getConsumers().size).toBe(1);
    expect(producer.getConsumers().entries().next().value[0]).toBe(consumer);
    expect(producer.getSources().size).toBe(0);

    // Consumer.
    expect(consumer.getConsumers().size).toBe(0);
    expect(consumer.getSources().size).toBe(1);
    expect(consumer.getSources().entries().next().value[0]).toBe(producer);
  });

  /**
   * Multiple middleware connections.
   */
  test('should be able to connect multiple middlewares', () => {
    const stack = new PlaceholderStack(app, 'PlaceholderStack');
    
    // The cache storage.
    const cacheStorage = new CacheStorage(stack, 'CacheStorage');

    // The producer middleware.
    const producer = new ProducerMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('ProducerMiddleware')
      .withCacheStorage(cacheStorage)
      .build();

    // The consumers middlewares.
    const consumers: Middleware[] = [];

    for (let i = 0; i < 10; i++) {
      const consumer = new ConsumerMiddleware.Builder()
        .withScope(stack)
        .withIdentifier(`ConsumerMiddleware${i}`)
        .withCacheStorage(cacheStorage)
        .build();
      
      if (i > 0) {
        consumers[i - 1].pipe(consumer);
      } else {
        producer.pipe(consumer);
      }

      // Add the consumer to the list of consumers.
      consumers.push(consumer);
    }

    for (let i = 0; i < 10; i++) {
      // Verify that the producer is connected to exactly one consumer.
      expect(consumers[i].getSources().size).toBe(1);

      // Verify that all consumers, except the last one, are connected to
      // exactly one other consumer.
      if (i < 9) {
        expect(consumers[i].getConsumers().size).toBe(1);
      }

      // Verify that all consumers, except the first one, are connected to
      // the previous consumer in the array.
      if (i > 0) {
        expect(consumers[i].getSources().entries().next().value[0]).toBe(consumers[i - 1]);
      }
    }
  });

  /**
   * Event triggering.
   */
  test('should trigger events when connecting middlewares', async () => {
    const stack = new PlaceholderStack(app, 'PlaceholderStack');

    // The cache storage.
    const cacheStorage = new CacheStorage(stack, 'CacheStorage');

    // The producer middleware.
    const producer = new ProducerMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('ProducerMiddleware')
      .withCacheStorage(cacheStorage)
      .build();
    
    // The consumer middleware.
    const consumer = new ConsumerMiddleware.Builder()
      .withScope(stack)
      .withIdentifier('ConsumerMiddleware')
      .withCacheStorage(cacheStorage)
      .build();

    // Connect the consumer to the producer.
    producer.pipe(consumer);

    return (new Promise((resolve) => {
      let count = 0;

      producer.on('consumer-added', () => {
        count = count + 1;
        if (count === 2) resolve(count);
      });
  
      consumer.on('source-added', () => {
        count = count + 1;
        if (count === 2) resolve(count);
      });
    }));
  });
});