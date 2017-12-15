import * as t from 'io-ts'
import { Option } from 'fp-ts/lib/Option'
import { Newtype, iso } from 'newtype-ts'
import { fromNewtype } from 'io-ts-types/lib/newtype-ts/fromNewtype'

export type Id = Newtype<'Id', string>

export const idIso = iso<Id>()

const Id = fromNewtype<Id>(t.string)

//
// Model
//

export const Todo = t.interface({
  id: Id,
  text: t.string,
  completed: t.boolean
})

export const Todos = t.array(Todo)

export interface Todo {
  readonly id: Id
  readonly text: string
  readonly completed: boolean
}

export interface Model {
  readonly route: Route
  readonly todos: Array<Todo>
  readonly adding: string
  readonly editing: Option<Id>
}

//
// Msg
//

export class NoOp {
  static value: Msg = new NoOp()
  readonly _tag = 'NoOp'
  private constructor() {}
}

export class EnterTodo {
  readonly _tag = 'EnterTodo'
  constructor(readonly text: string) {}
  static create(text: string): Msg {
    return new EnterTodo(text)
  }
}

export class AddTodo {
  static value: Msg = new AddTodo()
  readonly _tag = 'AddTodo'
  private constructor() {}
}

export class RemoveTodo {
  readonly _tag = 'RemoveTodo'
  private constructor(readonly id: Id) {}
  static create(id: Id): Msg {
    return new RemoveTodo(id)
  }
}

export class ToggleTodo {
  readonly _tag = 'ToggleTodo'
  private constructor(readonly id: Id) {}
  static create(id: Id): Msg {
    return new ToggleTodo(id)
  }
}

export class Navigate {
  readonly _tag = 'Navigate'
  private constructor(readonly route: Route) {}
  static create(route: Route): Msg {
    return new Navigate(route)
  }
}

export class LoadTodos {
  readonly _tag = 'LoadTodos'
  private constructor(readonly todos: Array<Todo>) {}
  static create(todos: Array<Todo>): Msg {
    return new LoadTodos(todos)
  }
}

export class EditTodo {
  readonly _tag = 'EditTodo'
  private constructor(readonly id: Id) {}
  static create(id: Id): Msg {
    return new EditTodo(id)
  }
}

export class UpdateTodo {
  readonly _tag = 'UpdateTodo'
  private constructor(readonly id: Id, readonly text: string) {}
  static create(id: Id, text: string): Msg {
    return new UpdateTodo(id, text)
  }
}

export class Cancel {
  static value: Msg = new Cancel()
  readonly _tag = 'Cancel'
  private constructor() {}
}

export class ToggleAll {
  readonly _tag = 'ToggleAll'
  private constructor(readonly value: boolean) {}
  static create(value: boolean): Msg {
    return new ToggleAll(value)
  }
}

export class ClearCompleted {
  static value: Msg = new ClearCompleted()
  readonly _tag = 'ClearCompleted'
  private constructor() {}
}

export type Msg =
  | NoOp
  | EnterTodo
  | AddTodo
  | RemoveTodo
  | ToggleTodo
  | Navigate
  | LoadTodos
  | EditTodo
  | UpdateTodo
  | Cancel
  | ToggleAll
  | ClearCompleted

//
// Route
//

export class All {
  static value: Route = new All()
  readonly _tag = 'All'
  private constructor() {}
}

export class Active {
  static value: Route = new Active()
  readonly _tag = 'Active'
  private constructor() {}
}

export class Completed {
  static value: Route = new Completed()
  readonly _tag = 'Completed'
  private constructor() {}
}

export class NotFound {
  static value: Route = new NotFound()
  readonly _tag = 'NotFound'
  private constructor() {}
}

export type Route = All | Active | Completed | NotFound
