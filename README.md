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

- [bruno-language-server](https://github.com/DaviTostes/bruno-language-server)  
  Used as the main Language Server Protocol server for Bruno files.  

### Grammar

The extension uses the [tree-sitter-bruno](https://github.com/Scalamando/tree-sitter-bruno) grammar.

### Formatter

Formatting is provided by a custom formatter server implemented in `scripts/format_server.mjs`.

That formatter server uses:
- [prettify-bru](https://github.com/martinjoiner/prettify-bru)  
  The formatter is registered in the Bruno language configuration and is exposed to Zed through the `bruno-formatter` language server entry.
