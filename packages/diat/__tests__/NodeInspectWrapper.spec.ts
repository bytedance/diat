import { NodeInspectWrapper } from '../src/NodeInspectWrapper'
import { createTestProcess, kTimeout } from './utils';

describe('NodeInspectWrapper', () => {
  // TODO find out somehow to test this
  it('should work', async () => {
    const { child, message } = await createTestProcess('inspector_open')
    const { host, port } = message

    const wrapper = new NodeInspectWrapper({
      host,
      port
    })

    // const bufs: any[] = []
    // process.stdout.on('data', data => {
    //   bufs.push(data);
    // })

    wrapper.startInspect()
    // process.stdin.push('help')
    // process.stdin.push(null)

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 100)
    })

    // console.log('content', Buffer.concat(bufs).toString('utf8'))

    child.kill()
  }, kTimeout);
})
