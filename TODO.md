# TODO

## For 0.3.0
- [ ] Create a full-stack [realworld](https://github.com/gothinkster/realworld) implementation
- [ ] Fix vite client types reexport
- [ ] Add command to unpublish all canary releases
- [ ] Investigate Vite fs.allow warning: https://vitejs.dev/config/#server-fs-allow
- [ ] Investigate the circular dependency warning
- [ ] Investigate Cannot set property 'isSelfAccepting' of undefined
- [x] Remove `getRootContext` in favor of `servePage`
  - [ ] Update examples
- [x] Manage focus after navigation
- [x] Fix hot reloading issues
  - [x] Newly created pages and layouts work correctly
  - [x] Layout hot updates are reflected correctly
- [x] Make navigate() globally accessible
- [x] Fix bug caused by rerender overwriting the next URL

## For 1.0.0
- Features
  - [ ] Static site generation
  - [ ] Add a way to add cache-related HTTP headers on pages
  - [ ] Service workers
  - [ ] Link prefetching
  - [ ] HTTPS in dev server
  - [ ] Spread dynamic route parameters
  - [ ] Localizable and customizable router
  - [ ] Serverless platforms
  - [ ] Data caching
  	- [ ] Optimistic updates
  	- [ ] Stale while revalidate strategy
- Chores
  - [ ] Set up Cypress
    - [ ] for Rakkas itself
    - [ ] for demo templates
  - [ ] Contribution guidelines
  - [ ] Send PR to `awesome-react`
  - [ ] Create integration examples with popular tools
    - [ ] Redux
    - [ ] Apollo
    - [ ] Styled components
    - [ ] Tailwind CSS
