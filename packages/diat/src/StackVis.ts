import * as stackvis from 'diat-stackvis-simplified/lib/stackvis'
import * as stream from 'stream'
import * as fs from 'fs'
import { logger } from './Logger'
import { getAbsolutePath } from './utils'

const emptyCallback = () => {}

export class StackVis {
  constructor() {
    //
  }

  collapsePerfStream = (
    dataStream: stream.Readable,
    outStream: stream.Writable
  ) => {
    const reader = stackvis.readerLookup('perf')
    const writer = stackvis.writerLookup('collapsed')

    stackvis.pipeStacks(
      logger,
      dataStream,
      reader,
      writer,
      outStream,
      emptyCallback
    )
  }

  collapsedToSvg = (
    dataStream: stream.Readable,
    outStream: stream.Writable
  ) => {
    const reader = stackvis.readerLookup('collapsed')
    const writer = stackvis.writerLookup('flamegraph-svg')

    stackvis.pipeStacks(
      logger,
      dataStream,
      reader,
      writer,
      outStream,
      emptyCallback
    )
  }

  perfStackToSvg = async (
    inputFilePath: string,
    outputFilePath: string
  ): Promise<string> => {
    const readable = fs.createReadStream(getAbsolutePath(inputFilePath))
    const pass = new stream.PassThrough()
    const writable = fs.createWriteStream(getAbsolutePath(outputFilePath))

    this.collapsePerfStream(readable, pass)
    this.collapsedToSvg(pass, writable)

    await new Promise(resolve => {
      writable.on('finish', () => {
        resolve()
      })
    })

    return getAbsolutePath(outputFilePath)
  }
}
