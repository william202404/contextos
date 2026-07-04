# Security and Data Handling

ContextOS is local-first. Project data, API keys, MCP tokens, and custom server credentials are stored on the user's device through browser or Electron local storage.

## Do Not Commit

Never commit real credentials or local runtime data, including:

- `.env` files
- API keys or access tokens
- private keys or signing certificates
- local database exports
- Electron release artifacts

## Current Repository Check

The public repository should contain source code, documentation, and non-sensitive demo assets only. Placeholder strings such as `sk-...` or `API Key...` are UI examples and not real credentials.

## If a Secret Is Exposed

1. Revoke the exposed credential immediately.
2. Remove it from the working tree.
3. If it was committed, rewrite the affected Git history or rotate the credential before continuing to use the repository.
