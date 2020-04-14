import * as fs from 'fs'
import * as util from 'util'
import * as path from 'path'
import { DiatError } from './Error'

const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)

const kPath = path.resolve(__dirname, '../snippet')

export class Snippets {
  private snippets: { [name: string]: string } | null = null

  constructor() {
    //
  }

  getSnippets = async () => {
    if (this.snippets) {
      return this.snippets
    }

    const files = await readdir(kPath)
    const snippets = {}

    for (let file of files) {
      const content = await readFile(path.resolve(kPath, file))
      const name = path.basename(file, '.js')
      snippets[name] = content.toString('utf8')
    }

    this.snippets = snippets

    return this.snippets
  }

  getSnippet = async (name: string, options: any = {}) => {
    const snippets = await this.getSnippets()

    const snippet = snippets[name]

    if (!snippet) {
      throw new DiatError(`snippet ${name} doesn't exist`)
    }

    const kOptionsReplaceReg = /__OPTIONS__/g
    return snippet.replace(kOptionsReplaceReg, JSON.stringify(options))
  }
}

export const snippets = new Snippets()
