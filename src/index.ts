import * as React from 'elm-ts/lib/React'
import { program } from 'elm-ts/lib/Navigation'
import { locationToMessage, init, update, view } from './App'
import { render } from 'react-dom'

const main = program(locationToMessage, init, update, view)

React.run(main, dom => render(dom, document.getElementsByClassName('todoapp')[0]))
