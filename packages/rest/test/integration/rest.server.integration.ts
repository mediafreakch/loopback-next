// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Application} from '@loopback/core';
import {
  supertest,
  expect,
  createClientForHandler,
  itSkippedOnTravis,
  httpsGetAsync,
  givenHttpServerConfig,
} from '@loopback/testlab';
import {
  RestBindings,
  RestServer,
  RestComponent,
  get,
  Request,
  RestServerConfig,
  BodyParser,
} from '../..';
import {IncomingMessage, ServerResponse} from 'http';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
const readFileAsync = util.promisify(fs.readFile);

import {is} from 'type-is';
import {requestBody, post} from '../../src';

const FIXTURES = path.resolve(__dirname, '../../../fixtures');
const ASSETS = path.resolve(FIXTURES, 'assets');

describe('RestServer (integration)', () => {
  it('exports url property', async () => {
    // Explicitly setting host to IPv4 address so test runs on Travis
    const server = await givenAServer({rest: {port: 0, host: '127.0.0.1'}});
    server.handler(dummyRequestHandler);
    expect(server.url).to.be.undefined();
    await server.start();
    expect(server)
      .to.have.property('url')
      .which.is.a.String()
      .match(/http|https\:\/\//);
    await supertest(server.url)
      .get('/')
      .expect(200, 'Hello');
    await server.stop();
    expect(server.url).to.be.undefined();
  });

  it('updates rest.port binding when listening on ephemeral port', async () => {
    const server = await givenAServer({rest: {port: 0}});
    await server.start();
    expect(server.getSync(RestBindings.PORT)).to.be.above(0);
    await server.stop();
  });

  it('honors port binding after instantiation', async () => {
    const server = await givenAServer({rest: {port: 80}});
    server.bind(RestBindings.PORT).to(0);
    await server.start();
    expect(server.getSync(RestBindings.PORT)).to.not.equal(80);
    await server.stop();
  });

  it('does not throw an error when stopping an app that has not been started', async () => {
    const server = await givenAServer();
    await expect(server.stop()).to.fulfilled();
  });

  it('responds with 500 when Sequence fails with unhandled error', async () => {
    const server = await givenAServer({rest: {port: 0}});
    server.handler((context, sequence) => {
      return Promise.reject(new Error('unhandled test error'));
    });

    // Temporarily disable Mocha's handling of uncaught exceptions
    const mochaListeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    process.once('uncaughtException', err => {
      expect(err).to.have.property('message', 'unhandled test error');
      for (const l of mochaListeners) {
        process.on('uncaughtException', l);
      }
    });

    return createClientForHandler(server.requestHandler)
      .get('/')
      .expect(500);
  });

  it('allows static assets to be mounted at /', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });

    expect(() => server.static('/', root)).to.not.throw();
    expect(() => server.static('', root)).to.not.throw();
    expect(() => server.static(['/'], root)).to.not.throw();
    expect(() => server.static(['/html', ''], root)).to.not.throw();
    expect(() => server.static(/.*/, root)).to.not.throw();
    expect(() => server.static('/(.*)', root)).to.not.throw();
  });

  it('allows static assets via api', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });

    server.static('/html', root);
    const content = fs
      .readFileSync(path.join(root, 'index.html'))
      .toString('utf-8');
    await createClientForHandler(server.requestHandler)
      .get('/html/index.html')
      .expect('Content-Type', /text\/html/)
      .expect(200, content);
  });

  it('allows static assets to be mounted on multiple paths', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });

    server.static('/html-0', root);
    server.static('/html-1', root);

    const content = fs
      .readFileSync(path.join(root, 'index.html'))
      .toString('utf-8');
    await createClientForHandler(server.requestHandler)
      .get('/html-0/index.html')
      .expect('Content-Type', /text\/html/)
      .expect(200, content);
    await createClientForHandler(server.requestHandler)
      .get('/html-1/index.html')
      .expect('Content-Type', /text\/html/)
      .expect(200, content);
  });

  it('merges different static asset directories when mounted on the same path', async () => {
    const root = ASSETS;
    const otherAssets = path.join(FIXTURES, 'other-assets');
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });

    server.static('/html', root);
    server.static('/html', otherAssets);

    let content = await readFileFromDirectory(root, 'index.html');
    await createClientForHandler(server.requestHandler)
      .get('/html/index.html')
      .expect('Content-Type', /text\/html/)
      .expect(200, content);

    content = await readFileFromDirectory(otherAssets, 'robots.txt');
    await createClientForHandler(server.requestHandler)
      .get('/html/robots.txt')
      .expect('Content-Type', /text\/plain/)
      .expect(200, content);
  });

  it('allows static assets via api after start', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });
    await createClientForHandler(server.requestHandler)
      .get('/html/index.html')
      .expect(404);

    server.static('/html', root);

    await createClientForHandler(server.requestHandler)
      .get('/html/index.html')
      .expect(200);
  });

  it('allows non-static routes after assets', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });
    server.static('/html', root);
    server.handler(dummyRequestHandler);

    await createClientForHandler(server.requestHandler)
      .get('/html/does-not-exist.html')
      .expect(200, 'Hello');
  });

  it('gives precedence to API routes over static assets', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });
    server.static('/html', root);
    server.handler(dummyRequestHandler);

    await createClientForHandler(server.requestHandler)
      .get('/html/index.html')
      .expect(200, 'Hello');
  });

  it('registers controllers defined later than static assets', async () => {
    const root = ASSETS;
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });
    server.static('/html', root);
    server.controller(DummyController);

    await createClientForHandler(server.requestHandler)
      .get('/html')
      .expect(200, 'Hi');
  });

  it('allows request body parser extensions', async () => {
    const body = '<key>value</key>';

    /**
     * A mock-up xml parser
     */
    class XmlBodyParser implements BodyParser {
      name: string = 'xml';
      supports(mediaType: string) {
        return !!is(mediaType, 'xml');
      }

      async parse(request: Request) {
        return {value: {key: 'value'}};
      }
    }

    const server = await givenAServer({rest: {port: 0}});
    // Register a request body parser for xml
    server.bodyParser(XmlBodyParser);
    server.controller(DummyXmlController);

    await createClientForHandler(server.requestHandler)
      .post('/')
      .set('Content-Type', 'application/xml')
      .send(body)
      .expect(200, {key: 'value'});
  });

  it('allows cors', async () => {
    const server = await givenAServer({rest: {port: 0}});
    server.handler(dummyRequestHandler);

    await createClientForHandler(server.requestHandler)
      .get('/')
      .expect(200, 'Hello')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Allow-Credentials', 'true');
  });

  it('allows cors preflight', async () => {
    const server = await givenAServer({rest: {port: 0}});
    server.handler(dummyRequestHandler);

    await createClientForHandler(server.requestHandler)
      .options('/')
      .expect(204)
      .expect('Access-Control-Allow-Origin', '*')
      .expect('Access-Control-Allow-Credentials', 'true')
      .expect('Access-Control-Max-Age', '86400');
  });

  it('allows custom CORS configuration', async () => {
    const server = await givenAServer({
      rest: {
        port: 0,
        cors: {
          optionsSuccessStatus: 200,
          maxAge: 1,
        },
      },
    });

    server.handler(dummyRequestHandler);

    await createClientForHandler(server.requestHandler)
      .options('/')
      .expect(200)
      .expect('Access-Control-Max-Age', '1');
  });

  it('exposes "GET /openapi.json" endpoint', async () => {
    const server = await givenAServer({
      rest: {
        port: 0,
      },
    });
    const greetSpec = {
      responses: {
        200: {
          content: {'text/plain': {schema: {type: 'string'}}},
          description: 'greeting of the day',
        },
      },
    };
    server.route('get', '/greet', greetSpec, function greet() {});

    const response = await createClientForHandler(server.requestHandler).get(
      '/openapi.json',
    );
    expect(response.body).to.containDeep({
      openapi: '3.0.0',
      info: {
        title: 'LoopBack Application',
        version: '1.0.0',
      },
      servers: [{url: '/'}],
      paths: {
        '/greet': {
          get: {
            responses: {
              '200': {
                content: {
                  'text/plain': {
                    schema: {type: 'string'},
                  },
                },
                description: 'greeting of the day',
              },
            },
          },
        },
      },
    });
    expect(response.get('Access-Control-Allow-Origin')).to.equal('*');
    expect(response.get('Access-Control-Allow-Credentials')).to.equal('true');
  });

  it('exposes "GET /openapi.json" with openApiSpec.servers', async () => {
    const server = await givenAServer({
      rest: {
        port: 0,
        openApiSpec: {
          servers: [{url: 'http://127.0.0.1:8080'}],
        },
      },
    });

    const response = await createClientForHandler(server.requestHandler).get(
      '/openapi.json',
    );
    expect(response.body.servers).to.eql([{url: 'http://127.0.0.1:8080'}]);
  });

  it('exposes "GET /openapi.json" with openApiSpec.setServersFromRequest', async () => {
    const server = await givenAServer({
      rest: {
        port: 0,
        openApiSpec: {
          setServersFromRequest: true,
        },
      },
    });

    const response = await createClientForHandler(server.requestHandler).get(
      '/openapi.json',
    );
    expect(response.body.servers[0].url).to.match(/http:\/\/127.0.0.1\:\d+/);
  });

  it('exposes endpoints with openApiSpec.endpointMapping', async () => {
    const server = await givenAServer({
      rest: {
        port: 0,
        openApiSpec: {
          endpointMapping: {
            '/openapi': {version: '3.0.0', format: 'yaml'},
          },
        },
      },
    });

    const test = createClientForHandler(server.requestHandler);
    await test.get('/openapi').expect(200, /openapi\: 3\.0\.0/);
    await test.get('/openapi.json').expect(404);
  });

  it('exposes "GET /openapi.yaml" endpoint', async () => {
    const server = await givenAServer({rest: {port: 0}});
    const greetSpec = {
      responses: {
        200: {
          content: {'text/plain': {schema: {type: 'string'}}},
          description: 'greeting of the day',
        },
      },
    };
    server.route('get', '/greet', greetSpec, function greet() {});

    const response = await createClientForHandler(server.requestHandler).get(
      '/openapi.yaml',
    );
    const expected = yaml.safeLoad(`
openapi: 3.0.0
info:
  title: LoopBack Application
  version: 1.0.0
paths:
  /greet:
    get:
      responses:
        '200':
          description: greeting of the day
          content:
            'text/plain':
              schema:
                type: string
    `);
    // Use json for comparison to tolerate textual diffs
    const json = yaml.safeLoad(response.text);
    expect(json).to.containDeep(expected);
    expect(json.servers[0].url).to.match('/');

    expect(response.get('Access-Control-Allow-Origin')).to.equal('*');
    expect(response.get('Access-Control-Allow-Credentials')).to.equal('true');
  });

  it('exposes "GET /explorer" endpoint', async () => {
    const app = new Application();
    app.component(RestComponent);
    const server = await app.getServer(RestServer);
    const greetSpec = {
      responses: {
        200: {
          schema: {type: 'string'},
          description: 'greeting of the day',
        },
      },
    };
    server.route('get', '/greet', greetSpec, function greet() {});

    const response = await createClientForHandler(server.requestHandler).get(
      '/explorer',
    );
    await server.get(RestBindings.PORT);
    const expectedUrl = new RegExp(
      [
        'http://explorer.loopback.io',
        '\\?url=http://\\d+.\\d+.\\d+.\\d+:\\d+/openapi.json',
      ].join(''),
    );
    expect(response.get('Location')).match(expectedUrl);
    expect(response.get('Access-Control-Allow-Origin')).to.equal('*');
    expect(response.get('Access-Control-Allow-Credentials')).to.equal('true');
  });

  it('honors "x-forwarded-*" headers', async () => {
    const app = new Application();
    app.component(RestComponent);
    const server = await app.getServer(RestServer);

    const response = await createClientForHandler(server.requestHandler)
      .get('/explorer')
      .set('x-forwarded-proto', 'https')
      .set('x-forwarded-host', 'example.com')
      .set('x-forwarded-port', '8080');
    await server.get(RestBindings.PORT);
    const expectedUrl = new RegExp(
      [
        'https://explorer.loopback.io',
        '\\?url=https://example.com:8080/openapi.json',
      ].join(''),
    );
    expect(response.get('Location')).match(expectedUrl);
  });

  it('honors "x-forwarded-host" headers', async () => {
    const app = new Application();
    app.component(RestComponent);
    const server = await app.getServer(RestServer);

    const response = await createClientForHandler(server.requestHandler)
      .get('/explorer')
      .set('x-forwarded-proto', 'http')
      .set('x-forwarded-host', 'example.com:8080,my.example.com:9080');
    await server.get(RestBindings.PORT);
    const expectedUrl = new RegExp(
      [
        'http://explorer.loopback.io',
        '\\?url=http://example.com:8080/openapi.json',
      ].join(''),
    );
    expect(response.get('Location')).match(expectedUrl);
  });

  it('skips port if it is the default for http or https', async () => {
    const app = new Application();
    app.component(RestComponent);
    const server = await app.getServer(RestServer);

    const response = await createClientForHandler(server.requestHandler)
      .get('/explorer')
      .set('x-forwarded-proto', 'https')
      .set('x-forwarded-host', 'example.com')
      .set('x-forwarded-port', '443');
    await server.get(RestBindings.PORT);
    const expectedUrl = new RegExp(
      [
        'https://explorer.loopback.io',
        '\\?url=https://example.com/openapi.json',
      ].join(''),
    );
    expect(response.get('Location')).match(expectedUrl);
  });

  it('exposes "GET /explorer" endpoint with apiExplorer.url', async () => {
    const server = await givenAServer({
      rest: {
        apiExplorer: {
          url: 'https://petstore.swagger.io',
        },
      },
    });

    const response = await createClientForHandler(server.requestHandler).get(
      '/explorer',
    );
    await server.get(RestBindings.PORT);
    const expectedUrl = new RegExp(
      [
        'https://petstore.swagger.io',
        '\\?url=http://\\d+.\\d+.\\d+.\\d+:\\d+/openapi.json',
      ].join(''),
    );
    expect(response.get('Location')).match(expectedUrl);
  });

  it('exposes "GET /explorer" endpoint with apiExplorer.urlForHttp', async () => {
    const server = await givenAServer({
      rest: {
        apiExplorer: {
          url: 'https://petstore.swagger.io',
          httpUrl: 'http://petstore.swagger.io',
        },
      },
    });

    const response = await createClientForHandler(server.requestHandler).get(
      '/explorer',
    );
    await server.get(RestBindings.PORT);
    const expectedUrl = new RegExp(
      [
        'http://petstore.swagger.io',
        '\\?url=http://\\d+.\\d+.\\d+.\\d+:\\d+/openapi.json',
      ].join(''),
    );
    expect(response.get('Location')).match(expectedUrl);
  });

  it('supports HTTPS protocol with key and certificate files', async () => {
    const keyPath = path.join(FIXTURES, 'key.pem');
    const certPath = path.join(FIXTURES, 'cert.pem');
    const options = {
      port: 0,
      protocol: 'https',
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    const serverOptions = givenHttpServerConfig(options);
    const server = await givenAServer({rest: serverOptions});
    server.handler(dummyRequestHandler);
    await server.start();
    const serverUrl = server.getSync(RestBindings.URL);
    const res = await httpsGetAsync(serverUrl);
    expect(res.statusCode).to.equal(200);
  });

  it('supports HTTPS protocol with a pfx file', async () => {
    const pfxPath = path.join(FIXTURES, 'pfx.pfx');
    const options = {
      port: 0,
      protocol: 'https',
      pfx: fs.readFileSync(pfxPath),
      passphrase: 'loopback4',
    };
    const serverOptions = givenHttpServerConfig(options);
    const server = await givenAServer({rest: serverOptions});
    server.handler(dummyRequestHandler);
    await server.start();
    const serverUrl = server.getSync(RestBindings.URL);
    const res = await httpsGetAsync(serverUrl);
    expect(res.statusCode).to.equal(200);
    await server.stop();
  });

  itSkippedOnTravis('handles IPv6 loopback address in HTTPS', async () => {
    const keyPath = path.join(FIXTURES, 'key.pem');
    const certPath = path.join(FIXTURES, 'cert.pem');
    const server = await givenAServer({
      rest: {
        port: 0,
        host: '::1',
        protocol: 'https',
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    });
    server.handler(dummyRequestHandler);
    await server.start();
    const serverUrl = server.getSync(RestBindings.URL);
    const res = await httpsGetAsync(serverUrl);
    expect(res.statusCode).to.equal(200);
    await server.stop();
  });

  // https://github.com/strongloop/loopback-next/issues/1623
  itSkippedOnTravis('handles IPv6 address for API Explorer UI', async () => {
    const keyPath = path.join(FIXTURES, 'key.pem');
    const certPath = path.join(FIXTURES, 'cert.pem');
    const server = await givenAServer({
      rest: {
        port: 0,
        host: '::1',
        protocol: 'https',
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    });
    server.handler(dummyRequestHandler);
    await server.start();
    const serverUrl = server.getSync(RestBindings.URL);

    // The `Location` header should be something like
    // https://explorer.loopback.io?url=https://[::1]:58470/openapi.json
    const res = await httpsGetAsync(serverUrl + '/explorer');
    const location = res.headers['location'];
    expect(location).to.match(/\[\:\:1\]\:\d+\/openapi.json/);
    expect(location).to.equal(
      `https://explorer.loopback.io?url=${serverUrl}/openapi.json`,
    );
    await server.stop();
  });

  it('honors HTTPS config binding after instantiation', async () => {
    const keyPath = path.join(FIXTURES, 'key.pem');
    const certPath = path.join(FIXTURES, 'cert.pem');
    const options = {
      port: 0,
      protocol: 'https',
    };
    const serverOptions = givenHttpServerConfig(options);
    const server = await givenAServer({rest: serverOptions});

    server.handler(dummyRequestHandler);
    await server.start();
    let serverUrl = server.getSync(RestBindings.URL);
    await expect(httpsGetAsync(serverUrl)).to.be.rejectedWith(/EPROTO/);
    await server.stop();
    server.bind(RestBindings.HTTPS_OPTIONS).to({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    });
    await server.start();
    serverUrl = server.getSync(RestBindings.URL);
    const res = await httpsGetAsync(serverUrl);
    expect(res.statusCode).to.equal(200);
    await server.stop();
  });

  async function givenAServer(options?: {rest: RestServerConfig}) {
    const app = new Application(options);
    app.component(RestComponent);
    return await app.getServer(RestServer);
  }

  function dummyRequestHandler(handler: {
    request: IncomingMessage;
    response: ServerResponse;
  }) {
    const {response} = handler;
    response.write('Hello');
    response.end();
  }

  class DummyController {
    constructor() {}
    @get('/html', {
      responses: {},
    })
    ping(): string {
      return 'Hi';
    }
  }

  class DummyXmlController {
    constructor() {}
    @post('/')
    echo(
      @requestBody({
        content: {
          'application/xml': {
            schema: {
              type: 'object',
            },
          },
        },
      })
      body: object,
    ): object {
      return body;
    }
  }

  function readFileFromDirectory(
    dirname: string,
    filename: string,
  ): Promise<string> {
    return readFileAsync(path.join(dirname, filename), {encoding: 'utf-8'});
  }
});
