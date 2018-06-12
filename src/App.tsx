import * as React from 'react'
import { findDOMNode } from 'react-dom'
import { cmd } from 'elm-ts/lib'
import { Html } from 'elm-ts/lib/React'
import { Location } from 'elm-ts/lib/Navigation'
import * as t from './types'
import { Lens } from 'monocle-ts'
import { Predicate } from 'fp-ts/lib/function'
import { lit, end, parse, Route, Match } from 'fp-ts-routing'
import { Option, none, some, fromEither } from 'fp-ts/lib/Option'
import { tryCatch } from 'fp-ts/lib/Either'
import { Cmd } from 'elm-ts/lib/Cmd'
import { perform } from 'elm-ts/lib/Task'
import { load, save } from './localStorage'
import * as classnames from 'classnames'
import { Dispatch } from 'elm-ts/lib/Platform'

//
// Router
//

const all = end

const active = lit('active').then(end)

const completed = lit('completed').then(end)

const router = active.parser
  .map(() => t.Active.value)
  .alt(completed.parser.map(() => t.Completed.value))
  .alt(all.parser.map(() => t.All.value))

const parseRoute = (pathname: string): t.Route => parse(router, Route.parse(pathname), t.NotFound.value)

function formatRoute<A>(match: Match<A>): (a: A) => string {
  return a => match.formatter.run(Route.empty, a).toString()
}

const allHref = formatRoute(all)({})

const activeHref = formatRoute(active)({})

const completedHref = formatRoute(completed)({})

//
// Effects
//

const NAMESPACE = 'reason-react-todos'

const parseTodos = (s: string): Option<Array<t.Todo>> => {
  return fromEither(tryCatch(() => JSON.parse(s)).chain(v => t.Todos.decode(v).mapLeft(() => new Error())))
}

const loadTodos: Cmd<t.Msg> = perform(load(NAMESPACE), a => t.LoadTodos.create(a.chain(parseTodos).getOrElse([])))

const saveToNamespace = save(NAMESPACE)

const saveTodos = (todos: Array<t.Todo>): Cmd<t.Msg> => {
  return perform(saveToNamespace(JSON.stringify(todos)), a => t.NoOp.value)
}

//
// Init
//

export const locationToMessage = (location: Location): t.Msg => {
  const route = parseRoute(location.pathname)
  return t.Navigate.create(route)
}

export const init = (location: Location): [t.Model, cmd.Cmd<t.Msg>] => {
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

const routeLens = Lens.fromProp<t.Model, 'route'>('route')

const todosLens = Lens.fromProp<t.Model, 'todos'>('todos')

const addingLens = Lens.fromProp<t.Model, 'adding'>('adding')

const textLens = Lens.fromProp<t.Todo, 'text'>('text')

const completedLens = Lens.fromProp<t.Todo, 'completed'>('completed')

const addTodoLens = new Lens<t.Model, [string, Array<t.Todo>]>(
  s => [addingLens.get(s), todosLens.get(s)],
  a => s => ({ ...s, adding: a[0], todos: a[1] })
)

const editingLens = Lens.fromProp<t.Model, 'editing'>('editing')

const makeTodo = (text: string): t.Todo => ({
  id: t.idIso.wrap(String(new Date().getTime())),
  text,
  completed: false
})

const addTodo = (model: t.Model): t.Model =>
  addTodoLens.set(['', [...todosLens.get(model), makeTodo(addingLens.get(model))]])(model)

const removeTodo = (id: t.Id, model: t.Model): t.Model =>
  todosLens.modify(todos => todos.filter(todo => todo.id !== id))(model)

const toggleTodo = (id: t.Id, model: t.Model): t.Model =>
  todosLens.modify(todos => todos.map(todo => (todo.id !== id ? todo : completedLens.set(!todo.completed)(todo))))(
    model
  )

const updateTodo = (id: t.Id, text: string, model: t.Model): t.Model =>
  todosLens.modify(todos => todos.map(todo => (todo.id !== id ? todo : textLens.set(text)(todo))))(model)

const withoutEffect = (model: t.Model): [t.Model, cmd.Cmd<t.Msg>] => [model, cmd.none]

const withSaveEffect = (model: t.Model): [t.Model, cmd.Cmd<t.Msg>] => [model, saveTodos(todosLens.get(model))]

//
// Update
//

export const update = (msg: t.Msg, model: t.Model): [t.Model, cmd.Cmd<t.Msg>] => {
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
  todo: t.Todo
  onRemoveTodo: () => void
  onToggleTodo: () => void
  onStartEdit: () => void
  editable: Option<{
    onEdit: (text: string) => void
    onCancel: () => void
  }>
}

class TodoComponent extends React.PureComponent<TodoComponentProps> {
  editField: HTMLInputElement | null = null
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
  todos: Array<t.Todo>
  allCompleted: boolean
  onRemoveTodo: (id: t.Id) => void
  onToggleTodo: (id: t.Id) => void
  onStartEdit: (id: t.Id) => () => void
  onEdit: (id: t.Id) => Option<(text: string) => void>
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
              key={t.idIso.unwrap(todo.id)}
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

const getFilter = (route: t.Route): Option<Filter> => {
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
  model: t.Model
  onFinish: () => void
  onChange: (text: string) => void
  onRemoveTodo: (id: t.Id) => void
  onToggleTodo: (id: t.Id) => void
  onStartEdit: (id: t.Id) => () => void
  onEdit: (id: t.Id) => (text: string) => void
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
      const onEdit = (id: t.Id) =>
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
    .getOrElseL(() => <NotFoundComponent />)
}

const getTodosFilter = (filter: Filter): Predicate<t.Todo> => {
  switch (filter) {
    case Filter.all:
      return () => true
    case Filter.active:
      return todo => !todo.completed
    case Filter.completed:
      return todo => todo.completed
  }
}

function memoize<A, B>(f: (a: A) => B): (a: A) => B {
  let memo: B
  let memoized = false
  return a => {
    if (!memoized) {
      memo = f(a)
      memoized = true
    }
    return memo
  }
}

const getHandlers = memoize((dispatch: Dispatch<t.Msg>) => ({
  onFinish: () => dispatch(t.AddTodo.value),
  onChange: (text: string) => dispatch(t.EnterTodo.create(text)),
  onRemoveTodo: (id: t.Id) => dispatch(t.RemoveTodo.create(id)),
  onToggleTodo: (id: t.Id) => dispatch(t.ToggleTodo.create(id)),
  onStartEdit: (id: t.Id) => () => dispatch(t.EditTodo.create(id)),
  onEdit: (id: t.Id) => (text: string) => dispatch(t.UpdateTodo.create(id, text)),
  onCancel: () => dispatch(t.Cancel.value),
  onToggleAll: (value: boolean) => dispatch(t.ToggleAll.create(value)),
  onClearCompleted: () => dispatch(t.ClearCompleted.value)
}))

export function view(model: t.Model): Html<t.Msg> {
  return dispatch => {
    return <AppComponent model={model} {...getHandlers(dispatch)} />
  }
}
