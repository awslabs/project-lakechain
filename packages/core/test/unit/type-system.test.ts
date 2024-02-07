import { matchMimeTypes } from '../../src/utils/mime-types';

describe('Type system', () => {

  /**
   * Empty types.
   */
  test('should not be able to match empty types', () => {
    expect(matchMimeTypes([], [])).toBe(false);
  });

  /**
   * Compatible types.
   */
  test('should be able to match compatible types', () => {
    // Strict type matching.
    expect(matchMimeTypes(
      ['application/json'],
      ['application/json']
    )).toBe(true);

    // Partial source type matching.
    expect(matchMimeTypes(
      ['application/json'],
      ['application/json', 'application/xml']
    )).toBe(true);

    // Partial target type matching.
    expect(matchMimeTypes(
      ['application/json', 'application/xml'],
      ['application/json']
    )).toBe(true);

    // Partial source and target type matching.
    expect(matchMimeTypes(
      ['application/json', 'application/xml'],
      ['application/json', 'application/xml']
    )).toBe(true);
    expect(matchMimeTypes(
      ['application/json', 'application/xml'],
      ['application/json', 'application/xml', 'text/plain']
    )).toBe(true);
  });

  /**
   * Type wildcards.
   */
  test('should be able to match type wildcards', () => {
    // Source type wildcard.
    expect(matchMimeTypes(
      ['application/*'],
      ['application/json']
    )).toBe(true);

    // Target type wildcard.
    expect(matchMimeTypes(
      ['application/json'],
      ['application/*']
    )).toBe(true);

    // Both source and target type wildcards.
    expect(matchMimeTypes(
      ['application/*'],
      ['application/*']
    )).toBe(true);

    // Source type wildcard with multiple types.
    expect(matchMimeTypes(
      ['application/*', 'text/*'],
      ['application/json']
    )).toBe(true);

    // Wildcard source type.
    expect(matchMimeTypes(
      ['*/*'],
      ['application/json']
    )).toBe(true);

    // Wildcard target type.
    expect(matchMimeTypes(
      ['application/json'],
      ['*/*']
    )).toBe(true);

    // All wildcard types.
    expect(matchMimeTypes(
      ['*/*'],
      ['*/*']
    )).toBe(true);
    expect(matchMimeTypes(
      ['*'],
      ['*']
    )).toBe(true);
  });

  /**
   * Incompatible types.
   */
  test('should not be able to match incompatible types', () => {
    // Different types.
    expect(matchMimeTypes(
      ['application/json'],
      ['application/xml']
    )).toBe(false);
    expect(matchMimeTypes(
      ['application/json', 'text/plain'],
      ['text/xml']
    )).toBe(false);

    // Source type wildcard.
    expect(matchMimeTypes(
      ['text/*'],
      ['application/xml']
    )).toBe(false);
  });
});
