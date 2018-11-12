// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/explorer
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {BindingKey} from '@loopback/context';
import {ApiExplorerConfig} from './explorer.types';

/**
 * Binding keys used by this component.
 */
export namespace ApiExplorerBindings {
  export const CONFIG = BindingKey.create<ApiExplorerConfig>(
    'explorer.config',
  );
}
