/**
 * API `message` when no authenticated user (no valid Bearer, and no dev X-User-Id when allowed).
 * User-facing copy remains `errorUxMap[AUTH_UNAUTHORIZED]` in clients.
 */
export const AUTH_REQUIRED_MESSAGE = "Authentication required";
