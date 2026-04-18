# Bruno Extension for Zed

This repository provides a Zed extension for the Bruno API client language. It adds:

- Syntax highlighting for `.bru` files
- Language Server Protocol (LSP) integration for Bruno
- Formatting support through a dedicated formatter server

## Features

- Bruno language registration for Zed
- Tree-sitter based grammar integration
- Bruno language server support
- Document formatting support for Bruno files

## Components

### LSP

This extension declares the following language servers:

- `bruno-language-server`  
  Used as the main Language Server Protocol server for Bruno files.  
  Repository: `https://github.com/DaviTostes/bruno-language-server`

- `bruno-formatter`  
  Used as a separate formatting server because the main Bruno language server does not provide formatting support.  
  Backend repository: `https://github.com/martinjoiner/prettify-bru`

### Grammar

The extension uses the `tree-sitter-bruno` grammar.

- Repository: `https://github.com/Scalamando/tree-sitter-bruno`

### Formatter

Formatting is provided by a custom formatter server implemented in `scripts/format_server.mjs`.

That formatter server uses:

- `prettify-bru` as the formatting backend  
  Repository: `https://github.com/martinjoiner/prettify-bru`

The formatter is registered in the Bruno language configuration and is exposed to Zed through the `bruno-formatter` language server entry.

## References

This project is based on or references the following components:

- Bruno: `https://github.com/usebruno/bruno`
- `tree-sitter-bruno`: `https://github.com/Scalamando/tree-sitter-bruno`
- `prettify-bru`: `https://github.com/martinjoiner/prettify-bru`
- Zed: `https://github.com/zed-industries/zed`
- Zed Extension API: `https://github.com/zed-industries/zed`

## Project Structure

- `extension.toml`  
  Declares the extension metadata, language servers, and grammar source.

- `languages/bruno/config.toml`  
  Defines the Bruno language configuration, file suffixes, brackets, and formatter integration.

- `scripts/format_server.mjs`  
  Implements a minimal LSP-compatible formatting server for Bruno files.

- `src/`  
  Contains the Rust source for the Zed extension.

## Development

This project is implemented as a Zed extension with Rust and a small JavaScript-based formatter server.

Main technologies used:

- Rust
- Zed Extension API
- JavaScript (Node.js) for the formatter server
- Tree-sitter grammar integration

## Notes

- Bruno files use the `.bru` extension.
- Formatting is handled separately from the main Bruno language server.
- The grammar and formatter are explicitly configured so the extension can provide both syntax and editing support inside Zed.
