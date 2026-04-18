# Bruno support for Zed

This repository provides Bruno language support for Zed. It adds:

- Syntax highlighting for `.bru` files
- Language Server Protocol (LSP) integration for Bruno
- Formatting support through a lightweight formatter adapter

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

Formatting is provided by a lightweight adapter implemented in `scripts/format_server.mjs`.

That adapter integrates:
- [prettify-bru](https://github.com/martinjoiner/prettify-bru)  
The formatter is registered in the Bruno language configuration and exposed to Zed through the `bruno-formatter` language server entry.
