(async () => {
  const inspector = require('inspector');
  let url = inspector.url();

  function nativeOpen_() {
    process.binding('inspector').open(0);
  }

  function openInspector() {
    try {
      inspector.open(0);
      return;
    } catch (err) {
      //
    }

    try {
      nativeOpen_();
    } catch (err) {
      throw err;
    }
  }

  if (!url) {
    openInspector();
    url = inspector.url();
  }
  return JSON.stringify({
    url
  });
})(__OPTIONS__);
