import * as React from 'elm-ts/lib/React'
import { program } from 'elm-ts/lib/Navigation'
import { locationToMessage, init, update, view, MonadLocalStorage } from './App'
import { render } from 'react-dom'
import { getItem, setItem } from './localStorage'

const M: MonadLocalStorage = {
  getItem,
  setItem
}

const main = program(locationToMessage, init(M), update(M), view)

React.run(main, dom => render(dom, document.getElementsByClassName('todoapp')[0]))
