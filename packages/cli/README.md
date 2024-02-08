# 📦 Lakechain CLI

---

![Static Badge](https://img.shields.io/badge/Project-Lakechain-danger?style=for-the-badge&color=green) ![Static Badge](https://img.shields.io/badge/API-unstable-danger?style=for-the-badge&color=orange)

---

> [!Warning]
> The Lakechain CLI is part of Project Lakechain. It is currently under heavy development.

## 🚀 Install

The Lakechain CLI is available on NPM. You can install it globally using the following command:

```bash
npm install --global @project-lakechain/cli
```

To verify that the CLI has been correctly installed, run the following command.

```bash
$ lkc --version
0.1.0
```

## 🔖 Features

- Middleware boilerplate code generation.
- Search and find the official middleware store.
- Local invocation of middlewares.
- Live logging of running middlewares in the terminal.
- Runs on Linux and MacOS.

## 🔰 Description

The Lakechain CLI is at the center of the new Developer Experience for helping developers use and develop Lakechain middlewares. It provides an easy-to-use interface to generate boilerplate code, and invoke middlewares locally.

It features multiple commands that we describe in this documentation. The below section describes the different commands that the CLI implements along with examples illustrating the usage of each one of them.

## Help

After installing the CLI, you can run the `lkc` command to list all of the commands it implements along with their description.

For each command that's implemented, you can also add the `--help` flag to get more information about a specific command.

```bash
$ lkc init --help
```

## Init

The `init` command generates a new middleware boilerplate code in the current directory.

##### Example

```bash
$ lkc init
```

##### Options

- `-n, --name <name>` - The name of the middleware.
- `-d, --description <description>` - The description of the middleware.
- `-a, --author <author>` - The author of the middleware.
- `-l, --license <license>` - The license of the middleware.

## List

The `list` command lists all the official Lakechain middlewares along with their description and attributes from the middleware store on the NPM registry.

##### Example

```bash
$ lkc list
```

##### Options

- `-r, --registry <registry>` - The base URL of an alternative NPM registry. Defaults to https://registry.npmjs.org/.
- `-o, --output <output>` - The output format of the list (table, json). Defaults to `table`.

## Search

The `search` command makes it possible to search for middlewares in the official Lakechain middleware store using a search query.

##### Example

```bash
$ lkc search --query "pdf"
```

##### Options

- `-t, --text <text>` - The text to search for in the middleware store.
- `-r, --registry <registry>` - The base URL of an alternative NPM registry. Defaults to https://registry.npmjs.org/.
- `-o, --output <output>` - The output format of the list (table, json). Defaults to `table`.

## Run

The `run` command allows to run middlewares locally within a Docker container, pass a document to them, and specify additional options.

##### Example

```bash
$ lkc run \
  --name @project-lakechain/pdf-text-converter \
  --document s3://<bucket>/<key>
```

## Build

## Examples
