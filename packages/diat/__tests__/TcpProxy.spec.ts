import * as net from 'net'
import { TcpProxy } from '../src/TcpProxy'

describe('TcpProxy', () => {
  const createTest = async () => {
    const serverSockets: net.Socket[] = []
    const server = await new Promise<net.Server>((resolve, reject) => {
      const server = net.createServer((socket) => {
        serverSockets.push(socket)
        socket.write('hello')
      })

      server.listen(0, () => {
        resolve(server)
      })
    })

    const tcpProxy = new TcpProxy({
      targetHost: '127.0.0.1',
      targetPort: (server.address() as any).port
    })

    const { host, port } = await tcpProxy.listen()

    const clientSocket = await new Promise<net.Socket>((resolve) => {
      const client = net.connect(port, host)

      client.on('data', (data) => {
        expect(data.toString('utf8')).toBe('hello')
        resolve(client)
      })
    })

    return {
      serverSockets,
      server,
      clientSocket
    }
  }

  it('should close the client socket if the server socket get closed', async () => {
    const {serverSockets, server, clientSocket} = await createTest()
    await new Promise((resolve) => {
      serverSockets.forEach(socket => socket.destroy())
      clientSocket.on('close', () => {
        resolve()
      })
    })
    server.close()
  })

  it('should close the server socket if the client socket get closed', async () => {
    const { serverSockets, server, clientSocket } = await createTest()
    clientSocket.destroy()
    await Promise.all(serverSockets.map(socket => new Promise((resolve) => {
      socket.on('close', () => {
        resolve()
      })
    })))
    server.close()
  })
})
