import {
  limit,
  exclude,
  categories,
  between,
  confidence,
  filter
} from '../../../src/dsl';

describe('Filter DSL', () => {

  /**
   * Limit DSL.
   */
  test('to be able to express a limit', () => {
    expect(limit(10)).toEqual({ limit: 10 });
  });

  /**
   * Exclude DSL.
   */
  test('to be able to express an exclude', () => {
    expect(exclude('foo')).toEqual({ exclude: ['foo'] });
    expect(exclude('foo', 'bar')).toEqual({ exclude: ['foo', 'bar'] });
  });

  /**
   * Categories DSL.
   */
  test('to be able to express a categories', () => {
    expect(categories('foo')).toEqual({ categories: ['foo'] });
    expect(categories('foo', 'bar')).toEqual({ categories: ['foo', 'bar'] });
  });

  /**
   * Between DSL.
   */
  test('to be able to express a between', () => {
    expect(between(0, 10)).toEqual({ range: { lhs: 0, rhs: 10 } });
  });

  /**
   * Confidence DSL.
   */
  test('to be able to express a confidence', () => {
    expect(confidence(0.5)).toEqual({ minConfidence: 0.5 });
  });

  /**
   * Filter DSL.
   */
  test('to be able to express a filter', () => {
    expect(filter('foo', 'bar')).toEqual({ filter: ['foo', 'bar'] });
    expect(filter(1, 2)).toEqual({ filter: [1, 2] });
  });
});