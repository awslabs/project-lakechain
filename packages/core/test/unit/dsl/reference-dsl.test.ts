import {
  reference,
  url,
  attribute,
  pointer,
  value
} from '../../../src/dsl';

describe('Reference DSL', () => {

  /**
   * URL references.
   */
  test('should be able to create a reference to a URL', () => {
    const ref = reference(url('https://amazon.com'));
    expect(ref.subject).toEqual({
      type: 'url',
      url: 'https://amazon.com'
    });
  });

  /**
   * Attribute references.
   */
  test('should be able to create a reference to an attribute', () => {
    const ref = reference(attribute('data.metadata.properties.kind'));
    expect(ref.subject).toEqual({
      type: 'attribute',
      attribute: 'data.metadata.properties.kind'
    });
  });

  /**
   * Pointer references.
   */
  test('should be able to create a reference to a pointer', () => {
    const ref = reference(pointer('data.metadata.properties.kind'));
    expect(ref.subject).toEqual({
      type: 'pointer',
      pointer: 'data.metadata.properties.kind'
    });
  });

  /**
   * Value references.
   */
  test('should be able to create a reference to a value', () => {
    const ref = reference(value('text'));
    expect(ref.subject).toEqual({
      type: 'value',
      value: 'text'
    });
  });
});