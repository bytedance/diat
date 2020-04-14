import { LinuxPerf } from '../src/LinuxPerf';

describe('LinuxPerf', () => {
  it('should return the module path', () => {
    const linuxPerf = new LinuxPerf();
    const modulePath = linuxPerf.getModulePath();
    expect(typeof modulePath).toBe('string');
  });
});
