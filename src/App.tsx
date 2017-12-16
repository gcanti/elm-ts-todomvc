import * as React from 'react'
import { findDOMNode } from 'react-dom'
import { cmd } from 'elm-ts/lib'
import { Html, Reader } from 'elm-ts/lib/React'
import { Location } from 'elm-ts/lib/Navigation'
import {
  Model,
  Msg,
  All,
  Active,
  Completed,
  NotFound,
  Todo,
  NoOp,
  AddTodo,
  EnterTodo,
  RemoveTodo,
  Navigate,
  Route,
  ToggleTodo,
  LoadTodos,
  Todos,
  UpdateTodo,
  EditTodo,
  Cancel,
  ToggleAll,
  ClearCompleted,
  Id,
  idIso
} from './types'
import { Lens } from 'monocle-ts'
import { Predicate } from 'fp-ts/lib/function'
import { lit, end, parse, Route as Path, Match } from 'fp-ts-routing'
import { Option, none, some } from 'fp-ts/lib/Option'
import { tryCatch } from 'fp-ts/lib/Either'
import { Cmd } from 'elm-ts/lib/Cmd'
import { perform } from 'elm-ts/lib/Task'
import { load, save } from './localStorage'
import { validate } from 'io-ts'
import * as classnames from 'classnames'

//
// Router
//

const all = end

const active = lit('active').then(end)

const completed = lit('completed').then(end)

const router = active.parser
  .map(() => Active.value)
  .alt(completed.parser.map(() => Completed.value))
  .alt(all.parser.map(() => All.value))

const parseRoute = (pathname: string): Route => parse(router, Path.parse(pathname), NotFound.value)

function formatRoute<A>(match: Match<A>): (a: A) => string {
  return a => match.formatter.run(Path.empty, a).toString()
}

const allHref = formatRoute(all)({})

const activeHref = formatRoute(active)({})

const completedHref = formatRoute(completed)({})

//
// Effects
//

const NAMESPACE = 'reason-react-todos'

const parseTodos = (s: string): Option<Array<Todo>> => {
  return tryCatch(() => JSON.parse(s))
    .chain(v => validate(v, Todos).mapLeft(() => new Error()))
    .toOption()
}

const loadTodos: Cmd<Msg> = perform(a => LoadTodos.create(a.chain(parseTodos).getOrElseValue([])), load(NAMESPACE))

const saveToNamespace = save(NAMESPACE)

const saveTodos = (todos: Array<Todo>): Cmd<Msg> => {
  return perform(a => NoOp.value, saveToNamespace(JSON.stringify(todos)))
}

//
// Init
//

export const locationToMessage = (location: Location): Msg => {
  const route = parseRoute(location.pathname)
  return Navigate.create(route)
}

export const init = (location: Location): [Model, cmd.Cmd<Msg>] => {
  const route = parseRoute(location.pathname)
  return [
    {
      route,
      todos: [],
      adding: '',
      editing: none
    },
    loadTodos
  ]
}

//
// Update helpers
//

const routeLens = Lens.fromProp<Model, 'route'>('route')

const todosLens = Lens.fromProp<Model, 'todos'>('todos')

const addingLens = Lens.fromProp<Model, 'adding'>('adding')

const textLens = Lens.fromProp<Todo, 'text'>('text')

const completedLens = Lens.fromProp<Todo, 'completed'>('completed')

const addTodoLens = new Lens<Model, [string, Array<Todo>]>(
  s => [addingLens.get(s), todosLens.get(s)],
  a => s => ({ ...s, adding: a[0], todos: a[1] })
)

const editingLens = Lens.fromProp<Model, 'editing'>('editing')

const makeTodo = (text: string): Todo => ({
  id: idIso.wrap(String(new Date().getTime())),
  text,
  completed: false
})

const addTodo = (model: Model): Model =>
  addTodoLens.set(['', [...todosLens.get(model), makeTodo(addingLens.get(model))]])(model)

const removeTodo = (id: Id, model: Model): Model =>
  todosLens.modify(todos => todos.filter(todo => todo.id !== id))(model)

const toggleTodo = (id: Id, model: Model): Model =>
  todosLens.modify(todos => todos.map(todo => (todo.id !== id ? todo : completedLens.set(!todo.completed)(todo))))(
    model
  )

const updateTodo = (id: Id, text: string, model: Model): Model =>
  todosLens.modify(todos => todos.map(todo => (todo.id !== id ? todo : textLens.set(text)(todo))))(model)

const withoutEffect = (model: Model): [Model, cmd.Cmd<Msg>] => [model, cmd.none]

const withSaveEffect = (model: Model): [Model, cmd.Cmd<Msg>] => [model, saveTodos(todosLens.get(model))]

//
// Update
//

export const update = (msg: Msg, model: Model): [Model, cmd.Cmd<Msg>] => {
  switch (msg._tag) {
    case 'NoOp':
      return withoutEffect(model)
    case 'EnterTodo':
      return withoutEffect(addingLens.set(msg.text)(model))
    case 'AddTodo':
      return withSaveEffect(addTodo(model))
    case 'RemoveTodo':
      return withSaveEffect(removeTodo(msg.id, model))
    case 'ToggleTodo':
      return withSaveEffect(toggleTodo(msg.id, model))
    case 'Navigate':
      return withoutEffect(routeLens.set(msg.route)(model))
    case 'LoadTodos':
      return withoutEffect(todosLens.set(msg.todos)(model))
    case 'EditTodo':
      return withoutEffect(editingLens.set(some(msg.id))(model))
    case 'UpdateTodo':
      return withSaveEffect(updateTodo(msg.id, msg.text, model))
    case 'Cancel':
      return withoutEffect(editingLens.set(none)(model))
    case 'ToggleAll':
      return withSaveEffect(todosLens.modify(todos => todos.map(completedLens.set(msg.value)))(model))
    case 'ClearCompleted':
      return withSaveEffect(todosLens.modify(todos => todos.filter(todo => !todo.completed))(model))
  }
}

//
// View
//

const ESCAPE_KEY = 27
const ENTER_KEY = 13

interface HeaderComponentProps {
  text: string
  onFinish: () => void
  onChange: (text: string) => void
}

const HeaderComponent = (props: HeaderComponentProps) => {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === ENTER_KEY) {
      props.onFinish()
    }
  }
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    props.onChange(e.target.value)
  }
  return (
    <header className="header">
      <h1>todos</h1>
      <input
        className="new-todo"
        placeholder="What needs to be done?"
        autoFocus={true}
        value={props.text}
        onKeyDown={onKeyDown}
        onChange={onChange}
      />
    </header>
  )
}

enum Filter {
  all = 'all',
  active = 'active',
  completed = 'completed'
}

interface FilterComponentProps {
  label: string
  href: string
  selected: boolean
}

const FilterComponent = (props: FilterComponentProps) => {
  const { label, href, selected } = props
  return (
    <li>
      <a href={href} className={selected ? 'selected' : undefined}>
        {label}
      </a>
    </li>
  )
}

interface FooterComponentProps {
  nrActiveTodos: number
  filter: Filter
  onClearCompleted: Option<() => void>
}

const FooterComponent = (props: FooterComponentProps) => {
  const { nrActiveTodos, filter, onClearCompleted } = props
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{nrActiveTodos}</strong>
        <span> items</span>
        <span> left</span>
      </span>
      <ul className="filters">
        <FilterComponent label="All" href={`#${allHref}`} selected={filter === Filter.all} />
        <span> </span>
        <FilterComponent label="Active" href={`#${activeHref}`} selected={filter === Filter.active} />
        <span> </span>
        <FilterComponent label="Completed" href={`#${completedHref}`} selected={filter === Filter.completed} />
      </ul>
      {onClearCompleted
        .map(onClearCompleted => (
          <button className="clear-completed" onClick={onClearCompleted}>
            Clear completed
          </button>
        ))
        .toUndefined()}
    </footer>
  )
}

interface TodoComponentProps {
  todo: Todo
  onRemoveTodo: () => void
  onToggleTodo: () => void
  onStartEdit: () => void
  editable: Option<{
    onEdit: (text: string) => void
    onCancel: () => void
  }>
}

class TodoComponent extends React.PureComponent<TodoComponentProps> {
  editField: HTMLInputElement | null
  componentDidUpdate(prevProps: TodoComponentProps) {
    if (this.editField && prevProps.editable.isNone() && this.props.editable.isSome()) {
      const node = findDOMNode(this.editField)
      if (node instanceof HTMLInputElement) {
        node.focus()
        node.setSelectionRange(node.value.length, node.value.length)
      }
    }
  }
  render() {
    const { todo, onRemoveTodo, onToggleTodo, onStartEdit, editable } = this.props
    const onEdit = editable.map(({ onEdit }) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onEdit(e.target.value)
    })
    const onCancel = editable.map(({ onCancel }) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.keyCode === ENTER_KEY || e.keyCode === ESCAPE_KEY) {
        onCancel()
      }
    })
    const className = {
      completed: todo.completed,
      editing: editable.isSome()
    }
    return (
      <li className={classnames(className)}>
        <div className="view">
          <input className="toggle" type="checkbox" checked={todo.completed} onChange={onToggleTodo} />
          <label onDoubleClick={onStartEdit}>{todo.text}</label>
          <button className="destroy" onClick={onRemoveTodo} />
        </div>
        <input
          ref={editField => (this.editField = editField)}
          className="edit"
          defaultValue={todo.text}
          onChange={onEdit.toUndefined()}
          onKeyDown={onCancel.toUndefined()}
        />
      </li>
    )
  }
}

interface TodosComponentProps {
  todos: Array<Todo>
  allCompleted: boolean
  onRemoveTodo: (id: Id) => void
  onToggleTodo: (id: Id) => void
  onStartEdit: (id: Id) => () => void
  onEdit: (id: Id) => Option<(text: string) => void>
  onCancel: () => void
  onToggleAll: (value: boolean) => void
}

const TodosComponent = (props: TodosComponentProps) => {
  const { todos, allCompleted, onRemoveTodo, onToggleTodo, onStartEdit, onEdit, onCancel } = props
  const onToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    props.onToggleAll(e.target.checked)
  }
  return (
    <section className="main">
      <input className="toggle-all" id="toggle-all" type="checkbox" checked={allCompleted} onChange={onToggleAll} />
      <label htmlFor="toggle-all">Mark all as complete</label>
      <ul className="todo-list">
        {todos.map(todo => {
          const editable = onEdit(todo.id).map(onEdit => ({
            onEdit,
            onCancel
          }))
          return (
            <TodoComponent
              todo={todo}
              key={idIso.unwrap(todo.id)}
              onRemoveTodo={() => onRemoveTodo(todo.id)}
              onToggleTodo={() => onToggleTodo(todo.id)}
              onStartEdit={onStartEdit(todo.id)}
              editable={editable}
            />
          )
        })}
      </ul>
    </section>
  )
}

const getFilter = (route: Route): Option<Filter> => {
  switch (route._tag) {
    case 'All':
      return some(Filter.all)
    case 'Active':
      return some(Filter.active)
    case 'Completed':
      return some(Filter.completed)
    case 'NotFound':
      return none
  }
}

const NotFoundComponent = () => {
  return (
    <div>
      <h1>Not found</h1>
      <footer className="footer">
        <ul className="filters">
          <li>
            <a href={`#${allHref}`}>All</a>
          </li>
        </ul>
      </footer>
    </div>
  )
}

interface AppComponentProps {
  model: Model
  onFinish: () => void
  onChange: (text: string) => void
  onRemoveTodo: (id: Id) => void
  onToggleTodo: (id: Id) => void
  onStartEdit: (id: Id) => () => void
  onEdit: (id: Id) => (text: string) => void
  onCancel: () => void
  onToggleAll: (value: boolean) => void
  onClearCompleted: () => void
}

const AppComponent = (props: AppComponentProps) => {
  const {
    model,
    onFinish,
    onChange,
    onRemoveTodo,
    onToggleTodo,
    onStartEdit,
    onCancel,
    onToggleAll,
    onClearCompleted
  } = props
  const ofilter = getFilter(routeLens.get(model))
  return ofilter
    .map(filter => {
      const text = addingLens.get(model)
      const todos = todosLens.get(model)
      const filteredTodos = todos.filter(getTodosFilter(filter))
      const allCompleted = todos.every(todo => todo.completed)
      const nrActiveTodos = todos.filter(getTodosFilter(Filter.active)).length
      const onEdit = (id: Id) =>
        editingLens.get(model).chain(editingId => (editingId === id ? some(props.onEdit(id)) : none))
      return (
        <div>
          <HeaderComponent text={text} onFinish={onFinish} onChange={onChange} />
          {todos.length === 0 ? null : (
            <>
              <TodosComponent
                todos={filteredTodos}
                allCompleted={allCompleted}
                onRemoveTodo={onRemoveTodo}
                onToggleTodo={onToggleTodo}
                onStartEdit={onStartEdit}
                onEdit={onEdit}
                onCancel={onCancel}
                onToggleAll={onToggleAll}
              />
              <FooterComponent
                nrActiveTodos={nrActiveTodos}
                filter={filter}
                onClearCompleted={todos.some(todo => todo.completed) ? some(onClearCompleted) : none}
              />
            </>
          )}
        </div>
      )
    })
    .getOrElse(() => <NotFoundComponent />)
}

const getTodosFilter = (filter: Filter): Predicate<Todo> => {
  switch (filter) {
    case Filter.all:
      return () => true
    case Filter.active:
      return todo => !todo.completed
    case Filter.completed:
      return todo => todo.completed
  }
}

export function view(model: Model): Html<Msg> {
  return new Reader(dispatch => {
    const onFinish = () => dispatch(AddTodo.value)
    const onChange = (text: string) => dispatch(EnterTodo.create(text))
    const onRemoveTodo = (id: Id) => dispatch(RemoveTodo.create(id))
    const onToggleTodo = (id: Id) => dispatch(ToggleTodo.create(id))
    const onStartEdit = (id: Id) => () => dispatch(EditTodo.create(id))
    const onEdit = (id: Id) => (text: string) => dispatch(UpdateTodo.create(id, text))
    const onCancel = () => dispatch(Cancel.value)
    const onToggleAll = (value: boolean) => dispatch(ToggleAll.create(value))
    const onClearCompleted = () => dispatch(ClearCompleted.value)
    return (
      <AppComponent
        model={model}
        onFinish={onFinish}
        onChange={onChange}
        onRemoveTodo={onRemoveTodo}
        onToggleTodo={onToggleTodo}
        onStartEdit={onStartEdit}
        onEdit={onEdit}
        onCancel={onCancel}
        onToggleAll={onToggleAll}
        onClearCompleted={onClearCompleted}
      />
    )
  })
}
