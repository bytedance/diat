/* istanbul ignore next */
export class Logger {
  log(...args) {
    return console.log(...args)
  }

  warn(...args) {
    return console.warn(...args)
  }

  error(...args) {
    return console.error(...args)
  }
}

export const logger = new Logger()
