// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RequestBodyParserOptions} from '../types';

import {text} from 'body-parser';
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

export class TextBodyParser implements BodyParser {
  name = 'text';
  private textParser: BodyParserWithCallback;

  constructor(
    @inject(RestBindings.REQUEST_BODY_PARSER_OPTIONS, {optional: true})
    options: RequestBodyParserOptions = {},
  ) {
    const textOptions = Object.assign(
      {type: 'text/*', limit: DEFAULT_LIMIT},
      getParserOptions('text', options),
    );
    this.textParser = text(textOptions);
  }

  supports(mediaType: string) {
    return !!is(mediaType, 'text/*');
  }

  async parse(request: Request): Promise<RequestBody> {
    const body = await parseRequest(this.textParser, request);
    return {value: body};
  }
}
