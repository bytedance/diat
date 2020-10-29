import { Communication } from "../src/Communication";
import { createTestProcess } from "./utils";

describe("Communication", () => {
  describe("connect", () => {
    it("should return null if connecting timeout", async () => {
      const child = await createTestProcess();
      const comm = new Communication({
        pid: child.pid,
        getBasicInfoTimeout: 1,
      });

      const ret = await comm.connect();
      await comm.disconnect();
      child.kill("SIGKILL");
    });

    it("should release the ws", async () => {
      const child = await createTestProcess();
      const comm = new Communication({
        pid: child.pid,
      });

      const ret = await comm.connect();
      expect(ret).toBeTruthy();

      await comm.releaseWs();
      expect(() => comm.post("Debugger.enable", {}, null)).toThrow("connect()");

      const ret2 = await comm.connect();
      expect(ret2).toBeTruthy();

      await comm.disconnect();
      child.kill("SIGKILL");
    });
  });

  describe("basic", () => {
    let comm: Communication;
    let child;

    beforeEach(async () => {
      child = await createTestProcess();
      comm = new Communication({
        pid: child.pid,
      });
    });

    afterEach(async () => {
      await comm.disconnect();
      child.kill("SIGKILL");
    });

    it("should post", async () => {
      const ret = await comm.connect();
      expect(ret).toEqual({
        pid: expect.anything(),
        version: expect.anything(),
      });
      await new Promise((resolve) => {
        comm.post("Debugger.enable", null, (err, result) => {
          expect(err).toBeFalsy();
          expect(result).toBeTruthy();
          resolve();
        });
      });
    });

    it("should execCode", async () => {
      await comm.connect();
      const ret = await comm.execCode(`
        (async () => {
          const value = await new Promise((resolve) => {
            setTimeout(() => {
              resolve('hello')
            }, 10)
          })
          return value
        })()
      `);
      expect(ret).toEqual({ result: { type: "string", value: "hello" } });
    });

    it("should emit events", async () => {
      let getCalled = false;
      await comm.connect();

      await new Promise((resolve, reject) => {
        comm.event.on("HeapProfiler.addHeapSnapshotChunk", (data) => {
          getCalled = true;
        });

        comm.post("HeapProfiler.takeHeapSnapshot", null, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      expect(getCalled).toBeTruthy();
    });

    it('should emit "close" event', async () => {
      await comm.connect();

      const p = new Promise((resolve) => {
        comm.event.once("LiveInspector.close", (params) => {
          resolve(params);
        });
      });

      child.kill();

      const params = await p;
      expect(params).toBeTruthy();
      expect(params).toEqual({
        code: 1006,
        reason: "",
      });
    });
  });
});
