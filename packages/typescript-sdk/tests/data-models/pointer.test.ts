/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Pointer, PointerBuilder } from '../../src/pointer';

/**
 * A constructible class implementing the
 * `from` static method to construct the
 * object from a plain object.
 */
class ConstructibleTodo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;

  constructor(opts: any) {
    this.userId = opts.userId;
    this.id = opts.id;
    this.title = opts.title;
    this.completed = opts.completed;
  }

  public static from(data: any) {
    return new ConstructibleTodo(data);
  }
}

/**
 * A plain data object.
 */
class Todo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

describe('Pointer Resolution', () => {

  /**
   * Invalid pointer construction.
   */
  it('should not be possible to construct an invalid pointer', () => {
    // Empty pointer.
    assert.throws(() => new PointerBuilder<ConstructibleTodo>().build());

    // Missing class type.
    assert.throws(() => new PointerBuilder<ConstructibleTodo>()
      .withUri('s3://example.com/example.json')
      .build()
    );

    // Missing URI.
    assert.throws(() => new PointerBuilder<ConstructibleTodo>()
      .withClassType(ConstructibleTodo)
      .build()
    );
  });

  /**
   * Valid pointer construction.
   */
  it('should be possible to construct a valid pointer', () => {
    const pointer1 = new PointerBuilder<ConstructibleTodo>()
      .withUri('s3://example/key')
      .withClassType(ConstructibleTodo)
      .build();
    const pointer2 = new Pointer<ConstructibleTodo>(
      new URL('s3://example2/key'),
      ConstructibleTodo
    );

    assert.equal(pointer1.getUri().toString(), 's3://example/key');
    assert.equal(pointer1.isResolved(), false);
    assert.equal(pointer2.getUri().toString(), 's3://example2/key');
    assert.equal(pointer2.isResolved(), false);
  });

  /**
   * Pointer resolution for constructible simple types.
   */
  it('should be possible to resolve a pointer to a simple constructible data type', async () => {
    const pointer = new PointerBuilder<ConstructibleTodo>()
      .withUri('https://jsonplaceholder.typicode.com/todos/1')
      .withClassType(ConstructibleTodo)
      .build();
    const data = await pointer.resolve();
    assert.equal(pointer.isResolved(), true);
    assert.equal(data instanceof ConstructibleTodo, true);
    assert.equal(data.id, 1);
    assert.equal(data.userId, 1);
    assert.equal(data.title, 'delectus aut autem');
    assert.equal(data.completed, false);
  });

  /**
   * Pointer resolution for constructible array types.
   */
  it('should be possible to resolve a pointer to a constructible array data type', async () => {
    const pointer = new PointerBuilder<Array<ConstructibleTodo>>()
      .withUri('https://jsonplaceholder.typicode.com/todos')
      .withClassType(ConstructibleTodo)
      .build();
    const data = await pointer.resolve();
    assert.equal(pointer.isResolved(), true);
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 200);
    assert.equal(data[0].id, 1);
    assert.equal(data[0].userId, 1);
    assert.equal(data[0].title, 'delectus aut autem');
    assert.equal(data[0].completed, false);
  });

  /**
   * Pointer resolution for plain types.
   */
  it('should be possible to resolve a pointer to a plain data type', async () => {
    const pointer = new PointerBuilder<Todo>()
      .withUri('https://jsonplaceholder.typicode.com/todos/1')
      .withClassType(Todo)
      .build();

    const data = await pointer.resolve();
    assert.equal(pointer.isResolved(), true);
    assert.equal(data instanceof Todo, true);
    assert.equal(data.id, 1);
    assert.equal(data.userId, 1);
    assert.equal(data.title, 'delectus aut autem');
    assert.equal(data.completed, false);
  });

  /**
   * Pointer resolution for plain array types.
   */
  it('should be possible to resolve a pointer to a plain array data type', async () => {
    const pointer = new PointerBuilder<Array<Todo>>()
      .withUri('https://jsonplaceholder.typicode.com/todos')
      .withClassType(Todo)
      .build();
    const data = await pointer.resolve();
    assert.equal(pointer.isResolved(), true);
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 200);
    assert.equal(data[0].id, 1);
    assert.equal(data[0].userId, 1);
    assert.equal(data[0].title, 'delectus aut autem');
    assert.equal(data[0].completed, false);
  });
})