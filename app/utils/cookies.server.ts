import { createCookie } from "@remix-run/node"; // or cloudflare/deno

import type { Cookie } from "@remix-run/node";

// find cookie by name from request headers
export function getCookie(name: string, headers: Headers) {
  const cookie = headers.get("cookie");
  if (!cookie) return null;

  const match = cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  if (match) return match[2];
}

/**
 * Parse a cookie from a request
 *
 */
export async function parseCookie<T>(
  cookie: Cookie,
  request: Request
): Promise<T | null> {
  const cookieHeader = request.headers.get("Cookie");
  const result = await cookie.parse(cookieHeader).catch(() => null);

  if (!result) {
    return null;
  }

  return result;
}

/**
 * Serialize a cookie for a response
 *
 */
export async function serializeCookie<T>(cookie: Cookie, value: T | null) {
  return cookie.serialize(value).catch(() => "");
}

/**
 * Serialize a cookie for deletion
 *
 */
export async function destroyCookie(cookie: Cookie) {
  return cookie.serialize("", { maxAge: 0 }).catch(() => "");
}

export function setCookie(cookieValue: string): [string, string] {
  return ["Set-Cookie", cookieValue];
}

/** USER PREFS COOKIE */

export const userPrefs = createCookie("user-prefs", {
  maxAge: 604_800, // one week
});

export async function updateCookieWithPerPage(
  request: Request,
  perPageParam: number
) {
  /* Get the cookie header */
  const cookieHeader = request.headers.get("Cookie");

  let cookie = (await userPrefs.parse(cookieHeader)) || {};
  /** If the cookie doesn't have perPage, adding perPage attribute and setting it to its default value 20*/
  if (!cookie.perPage) {
    cookie.perPage = 20;
  }
  /** If the perPageParam is different from the cookie, we update the cookie */
  if (cookie && perPageParam !== cookie.perPage && perPageParam !== 0) {
    cookie.perPage = perPageParam;
  }
  return cookie;
}

/**
 * Used to set the perPage cookie on the first load of the page if it doesn't exist
 *
 */
export async function initializePerPageCookieOnLayout(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await userPrefs.parse(cookieHeader)) || {};
  if (!cookie.perPage) {
    cookie.perPage = 20;
  }
  return cookie;
}
