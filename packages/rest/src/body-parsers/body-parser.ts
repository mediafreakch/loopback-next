// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as debugModule from 'debug';
import {Request, RequestBodyParserOptions} from '../types';
import {inject} from '@loopback/context';
import {isReferenceObject, OperationObject} from '../..';
import {is} from 'type-is';
import {RestHttpErrors} from '../rest-http-error';

const debug = debugModule('loopback:rest:body-parser');

import {RequestBody, BodyParser, REQUEST_BODY_PARSER_TAG} from './types';
import {getContentType, normalizeParsingError} from './helper';
import {RestBindings} from '../keys';
import {JsonBodyParser} from './body-parser.json';
import {UrlEncodedBodyParser} from './body-parser.urlencoded';
import {TextBodyParser} from './body-parser.text';

export class RequestBodyParser {
  constructor(
    @inject(RestBindings.REQUEST_BODY_PARSER_OPTIONS, {optional: true})
    options: RequestBodyParserOptions = {},
    @inject.tag(REQUEST_BODY_PARSER_TAG, {optional: true})
    private readonly parsers?: BodyParser[],
  ) {
    if (!parsers || parsers.length === 0) {
      this.parsers = [
        new JsonBodyParser(options),
        new UrlEncodedBodyParser(options),
        new TextBodyParser(options),
      ];
    }
  }

  async loadRequestBodyIfNeeded(
    operationSpec: OperationObject,
    request: Request,
  ): Promise<RequestBody> {
    const requestBody: RequestBody = {
      value: undefined,
    };
    if (!operationSpec.requestBody) return requestBody;

    const contentType = getContentType(request) || 'application/json';
    debug('Loading request body with content type %j', contentType);

    // the type of `operationSpec.requestBody` could be `RequestBodyObject`
    // or `ReferenceObject`, resolving a `$ref` value is not supported yet.
    if (isReferenceObject(operationSpec.requestBody)) {
      throw new Error('$ref requestBody is not supported yet.');
    }

    let content = operationSpec.requestBody.content || {};
    if (!Object.keys(content).length) {
      content = {
        // default to allow json and urlencoded
        'application/json': {schema: {type: 'object'}},
        'application/x-www-form-urlencoded': {schema: {type: 'object'}},
      };
    }

    // Check of the request content type matches one of the expected media
    // types in the request body spec
    let matchedMediaType: string | false = false;
    for (const type in content) {
      matchedMediaType = is(contentType, type);
      if (matchedMediaType) {
        debug('Matched media type: %s -> %s', type, contentType);
        requestBody.mediaType = type;
        requestBody.schema = content[type].schema;
        // Skip body parsing as the controller method wants to have full control
        if (content[type]['x-skip-body-parsing']) {
          requestBody.value = request;
          return requestBody;
        }
        break;
      }
    }

    if (!matchedMediaType) {
      // No matching media type found, fail fast
      throw RestHttpErrors.unsupportedMediaType(
        contentType,
        Object.keys(content),
      );
    }

    try {
      for (const parser of this.parsers || []) {
        if (!parser.supports(matchedMediaType)) {
          debug(
            'Body parser %s does not support %s',
            parser.name || (parser.constructor && parser.constructor.name),
            matchedMediaType,
          );
          continue;
        }
        debug(
          'Body parser %s found for %s',
          parser.name || (parser.constructor && parser.constructor.name),
          matchedMediaType,
        );
        const body = await parser.parse(request);
        return Object.assign(requestBody, body);
      }
    } catch (err) {
      throw normalizeParsingError(err);
    }

    throw RestHttpErrors.unsupportedMediaType(matchedMediaType);
  }
}
