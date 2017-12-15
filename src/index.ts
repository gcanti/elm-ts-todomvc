import * as React from 'elm-ts/lib/React'
import { program } from 'elm-ts/lib/Navigation'
import { locationToMessage, init, update, view } from './App'

const main = program(locationToMessage, init, update, view)

React.run(main, React.render(document.getElementsByClassName('todoapp')[0]))
