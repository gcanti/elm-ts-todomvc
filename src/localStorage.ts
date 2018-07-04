import { IO } from 'fp-ts/lib/IO'
import { Option, fromNullable } from 'fp-ts/lib/Option'

export const setItem = (key: string, value: string): IO<void> => new IO(() => localStorage.setItem(key, value))

export const getItem = (key: string): IO<Option<string>> => new IO(() => fromNullable(localStorage.getItem(key)))
