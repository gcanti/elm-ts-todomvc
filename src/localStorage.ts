import { Task, of } from 'fp-ts/lib/Task'
import { Option, fromNullable } from 'fp-ts/lib/Option'

export const save = (key: string) => (data: string): Task<void> => of(localStorage.setItem(key, data))

export const load = (key: string): Task<Option<string>> => of(fromNullable(localStorage.getItem(key)))
