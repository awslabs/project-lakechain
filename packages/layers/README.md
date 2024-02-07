# :package: Layer Library

---

![Static Badge](https://img.shields.io/badge/Project-Lakechain-danger?style=for-the-badge&color=green) ![Static Badge](https://img.shields.io/badge/API-unstable-danger?style=for-the-badge&color=orange)

---

> [!Warning]
> The Layer Library package has an unstable API and should not be used in a production environment.
> It should be assumed that the API will undergo heavy changes in upcoming versions.

## Overview

The Layer Library provides a set of Lambda Layers constructs that are used as part of [Project Lakechain](https://github.com/awslabs/project-lakechain) .

It currently supports the following layers :

- [**`Mediainfo`**](./src/mediainfo) - Allows to package the [MediaInfo](https://mediaarea.net/en/MediaInfo) library as a Lambda Layer.
- [**`Powertools`**](./src/powertools) - Allows to use the [AWS Lambda Powertools](https://docs.powertools.aws.dev/) for TypeScript and Python as an AWS Lambda Layer.
- [**`Sharp`**](./src/sharp) - Allows to package the [Sharp](https://sharp.pixelplumbing.com/) library as a Lambda Layer.

## Usage

### MediaInfo

Below is an example of how to use the `MediaInfo` layer.

```typescript
import { MediaInfoLayer } from '@project-lakechain/layers/mediainfo';

class MyStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // X64 architecture.
    const layer = MediaInfoLayer.x64(this, 'Layer');

    // ARM64 architecture.
    const layer = MediaInfoLayer.arm64(this, 'Layer');
  }
}
```

### AWS Powertools

Below is an example of hoe to use the AWS Powertools layer within a construct.

```typescript
import { PowerToolsLayer } from '@project-lakechain/layers/powertools';

class MyStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Powertools for TypeScript
    const layer = PowerToolsLayer.typescript().layer(this, 'Layer');

    // Powertools for Lambda (x64).
    const layer = PowerToolsLayer.python().x64(this, 'Layer');

    // Powertools for Lambda (arm64).
    const layer = PowerToolsLayer.python().arm64(this, 'Layer');
  }
}
```

### Sharp

Below is an example of hoe to use the Sharp layer within a construct.

```typescript
import { SharpLayer } from '@project-lakechain/layers/sharp';

class MyStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // X64 architecture.
    const layer = SharpLayer.arm64(this, 'Layer');
  }
}
```
