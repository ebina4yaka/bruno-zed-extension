# Bruno support for Zed

This repository provides Bruno language support for Zed. It adds:

- Syntax highlighting for `.bru` files
- Language Server Protocol (LSP) integration for Bruno

## Features

- Bruno language registration for Zed
- Tree-sitter based grammar integration
- Bruno language server support

## Components

### LSP

This extension declares the following language servers:

- [bruno-language-server](https://github.com/DaviTostes/bruno-language-server)  
  Used as the main Language Server Protocol server for Bruno files.

### Grammar

The extension uses the [tree-sitter-bruno](https://github.com/Scalamando/tree-sitter-bruno) grammar.
