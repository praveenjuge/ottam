/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_studioPolicy from "../lib/studioPolicy.js";
import type * as listenerProfiles from "../listenerProfiles.js";
import type * as mediaActions from "../mediaActions.js";
import type * as mediaInternal from "../mediaInternal.js";
import type * as mediaNode from "../mediaNode.js";
import type * as platform from "../platform.js";
import type * as series from "../series.js";
import type * as studio from "../studio.js";
import type * as studioActions from "../studioActions.js";
import type * as studioInternal from "../studioInternal.js";
import type * as voices from "../voices.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "lib/authorization": typeof lib_authorization;
  "lib/studioPolicy": typeof lib_studioPolicy;
  listenerProfiles: typeof listenerProfiles;
  mediaActions: typeof mediaActions;
  mediaInternal: typeof mediaInternal;
  mediaNode: typeof mediaNode;
  platform: typeof platform;
  series: typeof series;
  studio: typeof studio;
  studioActions: typeof studioActions;
  studioInternal: typeof studioInternal;
  voices: typeof voices;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
