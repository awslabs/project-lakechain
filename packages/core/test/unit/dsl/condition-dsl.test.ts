import { when } from '../../../src/dsl';

describe('Condition DSL', () => {

  /**
   * Simple unary conditions.
   */
  test('should be able to match simple unary conditions', () => {
    const condition = when('data.metadata.properties.kind');
    expect(condition.getSubject()).toEqual('data.metadata.properties.kind');
    expect(condition.isNegated()).toBe(false);
    expect(condition.getScope()).toEqual({
      data: {
        metadata: {
          properties: {
            kind: {}
          }
        }
      }
    });
    expect(condition.not().isNegated()).toBe(true);
    expect(condition.not().isNegated()).toBe(false);
  });

  /**
   * Simple equality conditions.
   */
  test('should be able to create simple equality conditions', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: ['text']
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').equals('text');
    expect(statement.value()).toEqual(value);
    expect(statement.subject()).toEqual('data.metadata.properties.kind');
  });

  /**
   * Simple negated equality conditions.
   */
  test('should be able to create simple negated equality conditions', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'anything-but': ['text']
            }]
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').not().equals('text');
    expect(statement.value()).toEqual(value);
  });

  /**
   * Simple bounded conditions.
   */
  test('should be able to create simple bounded conditions', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'numeric': [
                '>=',
                0,
                '<=',
                10
              ]
            }]
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').between(0, 10);
    expect(statement.value()).toEqual(value);
  });

  /**
   * Simple negated bounded conditions.
   */
  test('should not be able to create simple negated bounded conditions', () => {
    expect(() => when('data.metadata.properties.kind').not().between(0, 10)).toThrow();
  });

  /**
   * Simple numeric conditions.
   */
  test('should be able to create simple numeric conditions', () => {
    const greater = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'numeric': [
                '>',
                10
              ]
            }]
          }
        }
      }
    };

    const lower = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'numeric': [
                '<',
                10
              ]
            }]
          }
        }
      }
    };

    const greaterOrEqual = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'numeric': [
                '>=',
                10
              ]
            }]
          }
        }
      }
    };

    const lowerOrEqual = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'numeric': [
                '<=',
                10
              ]
            }]
          }
        }
      }
    };

    const greaterCondition = when('data.metadata.properties.kind').gt(10);
    expect(greaterCondition.value()).toEqual(greater);
    const lowerCondition = when('data.metadata.properties.kind').lt(10);
    expect(lowerCondition.value()).toEqual(lower);
    const greaterOrEqualCondition = when('data.metadata.properties.kind').gte(10);
    expect(greaterOrEqualCondition.value()).toEqual(greaterOrEqual);
    const lowerOrEqualCondition = when('data.metadata.properties.kind').lte(10);
    expect(lowerOrEqualCondition.value()).toEqual(lowerOrEqual);
  });

  /**
   * Simple existence conditions.
   */
  test('should be able to create simple existence conditions', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: [{
              exists: true
            }]
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').exists();
    expect(statement.value()).toEqual(value);
  });

  /**
   * Simple inclusion conditions.
   */
  test('should be able to create simple inclusion conditions', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: ['text', 'image']
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').includes('text', 'image');
    expect(statement.value()).toEqual(value);
  });

  /**
   * Simple starts with conditions.
   */
  test('should be able to create simple starts with conditions', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: [{
              'prefix': 'text'
            }]
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').startsWith('text');
    expect(statement.value()).toEqual(value);
  });

  /**
   * Complex conditions.
   */
  test('should be able to create complex conditions', () => {
    const statement1 = when('data.metadata.properties.kind')
      .not()
      .includes('text', 'image')
      .and(when('data.metadata.properties.attrs.value').between(0, 10));
    expect(statement1.value()).toEqual({
      data: {
        metadata: {
          properties: {
            attrs: {
              'value': [{
                'numeric': [
                  '>=',
                  0,
                  '<=',
                  10
                ]
              }]
            },
            kind: [{
              'anything-but': ['text', 'image']
            }]
          }
        }
      }
    });

    const statement2 = when('data.metadata.properties.attrs.value')
      .between(10, 100)
      .and(when('data.metadata.properties.attrs.value2').lt(100))
      .and(when('data.metadata.properties.attrs.kind').equals('text'));
    expect(statement2.value()).toEqual({
      data: {
        metadata: {
          properties: {
            attrs: {
              'kind': ['text'],
              'value': [{
                'numeric': [
                  '>=',
                  10,
                  '<=',
                  100
                ]
              }],
              'value2': [{
                'numeric': [
                  '<',
                  100
                ]
              }]
            }
          }
        }
      }
    });
  });

  /**
   * Condition serialization.
   */
  test('should be able to be serialized', () => {
    const value = {
      data: {
        metadata: {
          properties: {
            kind: ['text']
          }
        }
      }
    };

    const statement = when('data.metadata.properties.kind').equals('text');
    expect(JSON.stringify(statement)).toEqual(JSON.stringify(value));
  });
});
