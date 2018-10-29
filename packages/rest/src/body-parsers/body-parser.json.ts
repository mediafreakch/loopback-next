// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RequestBodyParserOptions} from '../types';

import {json} from 'body-parser';
import {inject} from '@loopback/context';
import {Request} from '../..';
import {RestBindings} from '../keys';
import {is} from 'type-is';

import {RequestBody, BodyParser} from './types';
import {
  BodyParserWithCallback,
  DEFAULT_LIMIT,
  getParserOptions,
  parseRequest,
} from './helper';

export class JsonBodyParser implements BodyParser {
  name = 'json';
  private jsonParser: BodyParserWithCallback;

  constructor(
    @inject(RestBindings.REQUEST_BODY_PARSER_OPTIONS, {optional: true})
    options: RequestBodyParserOptions = {},
  ) {
    const jsonOptions = Object.assign(
      {type: 'json', limit: DEFAULT_LIMIT},
      getParserOptions('json', options),
    );
    this.jsonParser = json(jsonOptions);
  }

  supports(mediaType: string) {
    return !!is(mediaType, 'json');
  }

  async parse(request: Request): Promise<RequestBody> {
    const body = await parseRequest(this.jsonParser, request);
    return {value: body};
  }
}
