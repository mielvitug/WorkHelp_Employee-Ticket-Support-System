import { createApp } from './app.js'

const host = '127.0.0.1'
const port = Number(process.env.PORT ?? 3001)
const app = createApp()
const server = app.listen(port, host, () => {
  console.log(`WorkHelp API listening at http://${host}:${port}`)
})

server.on('error', (error) => {
  console.error('Unable to start the WorkHelp API:', error.message)
  process.exitCode = 1
})

function closeServer() {
  server.close(() => {
    app.locals.db.close()
  })
}

process.on('SIGINT', closeServer)
process.on('SIGTERM', closeServer)
