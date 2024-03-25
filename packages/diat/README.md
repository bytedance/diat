## How to build?
```sh
# Clone the project
git clone https://github.com/deepnote/diat
cd diat/packages/diat

# Install all dependencies
npm install

# Build the project
npm run build

# Remove dev dependencies
npm prune --production
```

Inside of the `diat/packages/diat`, create and build the following dockerfile
```
FROM scratch
COPY . /usr/local/lib/node_modules/diat
```
```
docker build --platform linux/amd64 -t deepnote/diat:$VERSION .
```
