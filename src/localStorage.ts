import { Task, task } from 'fp-ts/lib/Task'
import { Option, fromNullable } from 'fp-ts/lib/Option'

export const save = (key: string) => (data: string): Task<void> => task.of(localStorage.setItem(key, data))

export const load = (key: string): Task<Option<string>> => task.of(fromNullable(localStorage.getItem(key)))
