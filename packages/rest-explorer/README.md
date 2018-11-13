# @loopback/rest-explorer

This module contains a component adding a self-hosted REST API Explorer to
LoopBack applications.

## Installation

```sh
npm install --save @loopback/rest-explorer
```

## Basic use

The component should be loaded in the constructor of your custom Application
class.

Start by importing the component class:

```ts
import {RestExplorerComponent} from '@loopback/rest-explorer';
```

In the constructor, add the component to your application:

```ts
this.component(RestExplorerComponent);
```

By default, API Explorer is mounted at `/explorer`. This path can be customized
via RestExplorer configuration as follows:

```ts
this.bind(RestExplorerBindings.CONFIG).to({
  path: '/openapi/ui',
});
```

## Contributions

- [Guidelines](https://github.com/strongloop/loopback-next/blob/master/docs/CONTRIBUTING.md)
- [Join the team](https://github.com/strongloop/loopback-next/issues/110)

## Tests

Run `npm test` from the root folder.

## Contributors

See
[all contributors](https://github.com/strongloop/loopback-next/graphs/contributors).

## License

MIT
