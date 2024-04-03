/**
 * A `ReducerStrategy` is a strategy that can be used to
 * define how the reducer should aggregate events.
 */
export interface ReducerStrategy {

  /**
   * @returns a description of the strategy.
   */
  compile(): any;

  /**
   * @returns the strategy name.
   */
  name(): string;
}
