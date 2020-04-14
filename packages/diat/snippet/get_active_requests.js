(async () => {
  const requests = process._getActiveRequests();
  return JSON.stringify(requests.map(i => i));
})();
