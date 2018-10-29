// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  Component,
  CoreBindings,
  ProviderMap,
  Server,
  Application,
} from '@loopback/core';
import {inject, Constructor, Binding, BindingScope} from '@loopback/context';
import {RestBindings} from './keys';
import {
  BindElementProvider,
  FindRouteProvider,
  GetFromContextProvider,
  InvokeMethodProvider,
  LogErrorProvider,
  RejectProvider,
  ParseParamsProvider,
  SendProvider,
} from './providers';
import {RestServer, RestServerConfig} from './rest.server';
import {DefaultSequence} from './sequence';
import {createEmptyApiSpec} from '@loopback/openapi-v3-types';
import {
  RequestBodyParser,
  JsonBodyParser,
  REQUEST_BODY_PARSER_TAG,
  TextBodyParser,
  UrlEncodedBodyParser,
} from './body-parsers';

export class RestComponent implements Component {
  providers: ProviderMap = {
    [RestBindings.SequenceActions.LOG_ERROR.key]: LogErrorProvider,
    [RestBindings.SequenceActions.FIND_ROUTE.key]: FindRouteProvider,
    [RestBindings.SequenceActions.INVOKE_METHOD.key]: InvokeMethodProvider,
    [RestBindings.SequenceActions.REJECT.key]: RejectProvider,
    [RestBindings.BIND_ELEMENT.key]: BindElementProvider,
    [RestBindings.GET_FROM_CONTEXT.key]: GetFromContextProvider,
    [RestBindings.SequenceActions.PARSE_PARAMS.key]: ParseParamsProvider,
    [RestBindings.SequenceActions.SEND.key]: SendProvider,
  };
  /**
   * Add built-in body parsers
   */
  bindings = [
    Binding.bind(RestBindings.REQUEST_BODY_PARSER)
      .toClass(RequestBodyParser)
      .inScope(BindingScope.SINGLETON),
    Binding.bind(RestBindings.REQUEST_BODY_PARSER_JSON)
      .toClass(JsonBodyParser)
      .inScope(BindingScope.SINGLETON)
      .tag(REQUEST_BODY_PARSER_TAG),
    Binding.bind(RestBindings.REQUEST_BODY_PARSER_TEXT)
      .toClass(TextBodyParser)
      .inScope(BindingScope.SINGLETON)
      .tag(REQUEST_BODY_PARSER_TAG),
    Binding.bind(RestBindings.REQUEST_BODY_PARSER_URLENCODED)
      .toClass(UrlEncodedBodyParser)
      .inScope(BindingScope.SINGLETON)
      .tag(REQUEST_BODY_PARSER_TAG),
  ];
  servers: {
    [name: string]: Constructor<Server>;
  } = {
    RestServer,
  };

  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE) app: Application,
    @inject(RestBindings.CONFIG) config?: RestComponentConfig,
  ) {
    app.bind(RestBindings.SEQUENCE).toClass(DefaultSequence);
    const apiSpec = createEmptyApiSpec();
    // Merge the OpenAPI `servers` spec from the config into the empty one
    if (config && config.openApiSpec && config.openApiSpec.servers) {
      Object.assign(apiSpec, {servers: config.openApiSpec.servers});
    }
    app.bind(RestBindings.API_SPEC).to(apiSpec);
  }
}

// TODO(kevin): Extend this interface def to include multiple servers?
export type RestComponentConfig = RestServerConfig;
