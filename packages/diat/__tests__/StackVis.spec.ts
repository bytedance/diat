import { StackVis } from '../src/StackVis';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';

const kPerfFile = path.resolve(__dirname, './out.perftext');
const kPerfSvg = path.resolve(__dirname, './result.svg');

describe('StackVis', () => {
  it('should work', async () => {
    const fileStream = fs.createReadStream(kPerfFile);
    const bufs: any[] = [];
    const svgBufs: any[] = [];
    const writable = new stream.Writable({
      write(chunk, encoding, callback) {
        bufs.push(chunk);
        callback();
      }
    });
    const vis = new StackVis();
    vis.collapsePerfStream(fileStream, writable);

    const result: any = await new Promise(resolve => {
      writable.on('finish', () => {
        resolve(Buffer.concat(bufs).toString('utf8'));
      });
    });
    expect(result.length).toBeGreaterThan(0);

    const readable = new stream.Readable({
      read() {
        this.push(null);
      }
    });
    readable.push(result);
    const svgWritable = new stream.Writable({
      write(chunk, encoding, callback) {
        svgBufs.push(chunk);
        callback();
      }
    });
    vis.collapsedToSvg(readable, svgWritable);

    const svg = await new Promise(resolve => {
      svgWritable.on('finish', () => {
        resolve(Buffer.concat(svgBufs).toString('utf8'));
      });
    });
    expect(svg).toContain('<svg');
  });

  it('should work', async () => {
    const vis = new StackVis();

    await vis.perfStackToSvg(kPerfFile, kPerfSvg);
  });
});
