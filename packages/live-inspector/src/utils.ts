export function wait(t: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, t);
  });
}
