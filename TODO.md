# TODO

- Static site generation
- Switch to automatic JSX runtime
- Integration examples (Redux, Apollo GraphQL, Styled Components, MDX, Tailwind CSS)
- Enhancements in the project generator
- Lots of minor features and fixes

## For 0.4.0
- [ ] Create examples
  - [ ] Styled components
  - [ ] Tailwind CSS
  - [ ] Apollo GraphQL
  - [ ] MDX

## For 1.0.0
- [ ] Investigate debugging and sourcemaps
- [ ] Design a setData API
  - [ ] Design a navigate with data API
- [ ] Investigate [vite-jest](https://github.com/sodatea/vite-jest)
- [ ] Serverless platforms
  - [ ] Vercel
  - [ ] AWS Lambda (Begin / Architect)
  - [ ] Cloudflare Workers
  - [ ] Netlify
- [ ] Add support for React 18 features (streaming SSR, Suspense, startTransition, server components etc.)
- [ ] Add support for multipart/form-data
- [ ] Localizable and customizable router
- [ ] Allow custom error serializers
- [ ] Add support for logging
- [ ] Make server limits (maximum request body size etc.) configurable
- [ ] Add a way to add cache-related HTTP headers on pages
- [ ] Service workers
- [ ] Link prefetching
- [ ] Spread dynamic route parameters
- [ ] Handle HEAD requests
- [ ] HTTPS in dev server
- [ ] Rendering modes
  - [ ] Static (rendered when building)
  - [ ] Server (rendered on the server)
  - [ ] Incremental (rendered on the server and cached, served from the cache afterwards)
  - [ ] Client (rendered on the client)
- [ ] A way to trigger reloads from the load function
- [ ] Serialize the routes into a smaller string in an external file
- [ ] Data caching
	- [ ] Optimistic updates
	- [ ] Stale while revalidate strategy
- [ ] RPC plugin
- [ ] Plugin system
- [ ] Contribution guidelines
- [ ] CLI command for creating pages, layouts, endpoints etc.
- [ ] Document rakkasjs types
- [ ] Investigate Vite warnings:
  - [ ] fs.allow warning: https://vitejs.dev/config/#server-fs-allow
  - [ ] Circular dependency warning
