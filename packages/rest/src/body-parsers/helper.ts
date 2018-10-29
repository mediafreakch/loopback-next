// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as debugModule from 'debug';
import {HttpError} from 'http-errors';
import {Request, Response, RequestBodyParserOptions} from '../types';

import {OptionsJson, OptionsUrlencoded, OptionsText} from 'body-parser';
const debug = debugModule('loopback:rest:body-parser');

/**
 * Get the content-type header value from the request
 * @param req Http request
 */
export function getContentType(req: Request): string | undefined {
  return req.get('content-type');
}

/**
 * Express body parser function type
 */
export type BodyParserWithCallback = (
  request: Request,
  response: Response,
  callback: (err: HttpError) => void,
) => void;

/**
 * Normalize parsing errors as `4xx`
 * @param err
 */
export function normalizeParsingError(err: HttpError) {
  debug('Cannot parse request body %j', err);
  if (!err.statusCode || err.statusCode >= 500) {
    err.statusCode = 400;
  }
  return err;
}

// tslint:disable:no-any

/**
 * Parse the body asynchronously
 * @param handle The express middleware handler
 * @param request Http request
 */
export function parseRequest(
  handle: BodyParserWithCallback,
  request: Request,
): Promise<any> {
  // A hack to fool TypeScript as we don't need `response`
  const response = ({} as any) as Response;
  return new Promise<void>((resolve, reject) => {
    handle(request, response, err => {
      if (err) {
        reject(normalizeParsingError(err));
        return;
      }
      resolve(request.body);
    });
  });
}

// Default limit of the body length
export const DEFAULT_LIMIT = '1mb';

/**
 * Extract parser options based on the parser type
 * @param type json|urlencoded|text
 * @param options
 */
export function getParserOptions(
  type: 'json',
  options: RequestBodyParserOptions,
): OptionsJson;
export function getParserOptions(
  type: 'urlencoded',
  options: RequestBodyParserOptions,
): OptionsUrlencoded;
export function getParserOptions(
  type: 'text',
  options: RequestBodyParserOptions,
): OptionsText;

export function getParserOptions<T extends 'json' | 'urlencoded' | 'text'>(
  type: T,
  options: RequestBodyParserOptions,
) {
  const opts: {[name: string]: any} = {};
  Object.assign(opts, options[type], options);
  for (const k of ['json', 'urlencoded', 'text']) {
    delete opts[k];
  }
  return opts;
}
