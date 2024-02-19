# 📦 Lakechain CLI

---

![Static Badge](https://img.shields.io/badge/Project-Lakechain-danger?style=for-the-badge&color=green) ![Static Badge](https://img.shields.io/badge/Release-Alpha-danger?style=for-the-badge&color=orange)

---

## 🚀 Install

The Lakechain CLI is available on NPM. You can install it globally using the following command:

```bash
npm install --global @project-lakechain/cli
```

To verify that the CLI has been correctly installed, run the following command.

```bash
$ lkc --version
0.3.4
```

Alternatively, you can also use `npx` to run the CLI without installing it globally.

```bash
$ npx @project-lakechain/cli --version
0.3.4
```

## 🔖 Features

- Create a new Lakechain pipeline project in a snap.
- Generate the boilerplate code for creating a new middleware.
- Search and find middlewares in the official middleware store.
- Runs on Linux and MacOS.

## 🔰 Description

The Lakechain CLI aims to enhance the experience of developers building Lakechain pipeline projects, and developing custom Lakechain middlewares.

It features different commands that we describe in this documentation. The below section describes the different commands that the CLI implements along with examples illustrating the usage of each one of them.

## Help

After installing the CLI, you can run the `lkc` command without arguments to list all the commands it implements along with their description.

```bash
$ lkc
```

For each command that's implemented, you can also add the `--help` flag to get more information about a specific command.

```bash
$ lkc init --help
```

## Init

The `init` command can be used to either generate a new Lakechain project on your file-system if you'd like to create your own pipelines as a separate CDK stack, or the boilerplate code used to create a new middleware very easily.

##### Example

```bash
$ lkc init
```

##### Options

- `-t, --type <type>` - The type of the project to generate (`app` or `middleware`).
- `-n, --name <name>` - The name of the project.
- `-d, --description <description>` - The description of the project.
- `-o, --output <output>` - A path on the filesystem in which the project will be created (the current directory by default).

## List

The `list` command lists all the official Lakechain middlewares along with their description and attributes from the middleware store.

##### Example

```bash
$ lkc list
```

##### Options

- `-o, --output <output>` - The output format (`table` or `json`). Defaults to `table`.
- `-r, --registry <registry>` - The base URL of an alternative NPM registry. Defaults to https://registry.npmjs.org/.

## Search

The `search` command makes it possible to search for middlewares in the official Lakechain middleware store using a search query.

##### Example

```bash
$ lkc search --query "pdf"
```

##### Options

- `-t, --text <text>` - The text to search for in the middleware store.
- `-o, --output <output>` - The output format (`table` or `json`). Defaults to `table`.
- `-r, --registry <registry>` - The base URL of an alternative NPM registry. Defaults to https://registry.npmjs.org/.

## Docs

The `docs` command is a shortcut to open the official Lakechain documentation in your default web browser.

##### Example

```bash
$ lkc docs
```

## Doctor

The `doctor` command checks the environment for any issues that might prevent customers from deploying pipelines using Lakechain and the AWS CDK.

##### Example

```bash
$ lkc doctor
```

