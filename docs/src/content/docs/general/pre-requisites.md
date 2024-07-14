---
title: Pre-requisites
---

In this section we outline the main pre-requisites for using Project Lakechain and start deploying pipelines.

### 💻 Environment

Project Lakechain has been successfully tested on different Linux distributions, MacOS, and Cloud development environments such as [AWS Cloud9](https://docs.aws.amazon.com/cloud9/latest/user-guide/welcome.html) and [GitHub Codespaces](https://github.com/features/codespaces).

We recommend having 50GB of free storage on your development machine to be able to build and deploy all the middlewares and examples.

> 👇 We have a ready made Dev Container for GitHub Codespaces that you can use to get started quickly.

<a href="https://codespaces.new/awslabs/project-lakechain"><img alt="Github Codespaces" src="https://github.com/codespaces/badge.svg" /></a>

> ℹ️ **Tip** We've also created a [Cloud9 script](https://github.com/awslabs/project-lakechain/blob/master/.cloud9/resize.sh) that you can use in your Cloud9 environment to resize the EBS storage associated with the instance.

<br>

---

### ☁️ AWS Access

You will need access to an AWS account on your development machine with valid credentials. You can use the [AWS CLI](https://aws.amazon.com/cli/) to verify that you have valid credentials.

> ℹ️ The AWS documentation describes how to [configure the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html).

```bash
$ aws sts get-caller-identity
```
<pre className="terminal" style="margin-top: 0">
{
  "UserId": "USEREXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:sts::123456789012:user/JohnDoe"
}
</pre>

<br>

---

### 🐳 Docker

As some middlewares are packaged as Docker containers, you need to have Docker installed and running on your development machine. You can use the [Docker CLI](https://docs.docker.com/engine/reference/commandline/cli/) to verify that you have access to the Docker daemon.

```bash
$ docker version
```

<pre className="terminal" style="margin-top: 0">
Client: Docker Engine - Community
 Version:           20.10.7
 API version:       1.41
 Go version:        go1.13.15
 Git commit:        f0df350
 Built:             Wed Jun  2 11:56:39 2021
 OS/Arch:           darwin/amd64
 Context:           default
</pre>

<br>

---

### 📦 Node.js + NPM

Node.js 18+ and NPM must be available to install the Lakechain project dependencies. You can use the [Node.js CLI](https://nodejs.org/api/cli.html) to verify that you have access to the Node.js runtime.

> We recommend using Node.js 20+. You can use [nvm](https://github.com/nvm-sh/nvm) to easily manage multiple versions of Node.js on your development machine.

```bash
$ node --version
```

<pre className="terminal" style="margin-top: 0">
v20.3.1
</pre>

<br>

---

### 🐍 Python and Pip

Python 3.9+ and Pip are used to package some Lakechain middlewares written in Python. You can use the [Python](https://docs.python.org/3/using/cmdline.html) binary to verify that you have a Python 3.9+ runtime up and running.

```bash
$ python3 --version
```

<pre className="terminal" style="margin-top: 0">
Python 3.11.5
</pre>

<br>

---

### Optional Dependencies

Although optional, as they will be installed by Project Lakechain and run using `npx`, we recommend installing the following dependencies on your development machine:

#### TypeScript 5.0+

```bash
$ npm install -g typescript
```

#### AWS CDK v2

```bash
$ npm install -g aws-cdk
```
