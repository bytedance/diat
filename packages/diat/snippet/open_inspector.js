(async () => {
  const inspector = require('inspector');
  let url = inspector.url();

  if (!url) {
    inspector.open(0);
    url = inspector.url();
  }
  return JSON.stringify({
    url
  });
})(__OPTIONS__);
