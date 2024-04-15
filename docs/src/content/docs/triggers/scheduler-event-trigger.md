---
title: Scheduler
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.7.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/scheduler-event-trigger">
    @project-lakechain/scheduler-event-trigger
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Scheduler trigger allows developers to schedule the execution of document processing pipelines on a recurring or one-time schedule.

---

### 🗓️ One-time Schedules

To use this middleware as part of your pipeline, you have to import it in your CDK stack and specify a [Schedule Expression](https://docs.aws.amazon.com/cdk/api/v2/docs/@aws-cdk_aws-scheduler-alpha.ScheduleExpression.html) that defines when to schedule the pipeline.

> ℹ️ In the below example, we schedule the pipeline to start in 24 hours.

```typescript
import * as scheduler from '@aws-cdk/aws-scheduler-alpha';
import { SchedulerEventTrigger } from '@project-lakechain/scheduler-event-trigger';
import { CacheStorage } from '@project-lakechain/core';

/**
 * @returns a date object representing the date
 * and time 24 hours from now.
 */
const tomorrow = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return (date);
};

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Create the Scheduler event trigger.
    const trigger = new SchedulerEventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withScheduleExpression(
        scheduler.ScheduleExpression.at(tomorrow())
      )
      .build();
  }
}
```

<br>

---

### 🔖 Cron Expressions

You can also use cron expressions to define when to schedule a pipeline.

> ℹ️ In the below example, we schedule the pipeline to run at 8:00PM UTC every Monday through Friday.

```typescript
const trigger = new SchedulerEventTrigger.Builder()
  .withScope(this)
  .withIdentifier('Trigger')
  .withCacheStorage(cache)
  .withScheduleExpression(
    scheduler.ScheduleExpression.expression('cron(0 20 ? * MON-FRI *)')
  )
  .build();
```

<br>

---

### ⏰ Rate Expressions

Another way to create a recurring schedule is to use a rate expression.

> ℹ️ In the below example, we schedule the pipeline to run every 5 minutes.

```typescript
const trigger = new SchedulerEventTrigger.Builder()
  .withScope(this)
  .withIdentifier('Trigger')
  .withCacheStorage(cache)
  .withScheduleExpression(
    scheduler.ScheduleExpression.rate(cdk.Duration.minutes(5))
  )
  .build();
```

<br>

---

### ⚠️ Important Note

This middleware does not act as a data source, but rather as a simple trigger because it does not yield any document by default. However, every middleware must provide a valid document that can be interpreted by the next middlewares.

To solve this issue, the Scheduler will send a placeholder document with the `application/json+scheduler` mime-type when the schedule is reached. This means that subsequent middlewares have to be explicitly configured to accept this mime-type, and know how to react when triggered by the scheduler.

#### Providing Documents

In some cases, it can be useful to provide input documents on a schedule. A common use-case for this is to create a recurrent pipeline that will fetch information from an external system on a regular basis.

The Scheduler API allows developers to pass an array of URIs identifying documents to use as an input for a scheduled pipeline using the `withDocuments` method.

> ℹ️ The below example will trigger the pipeline every 5 minutes, and create 2 different events for each document.

```typescript
const trigger = new SchedulerEventTrigger.Builder()
  .withScope(this)
  .withIdentifier('Trigger')
  .withCacheStorage(cache)
  .withScheduleExpression(
    scheduler.ScheduleExpression.rate(cdk.Duration.minutes(5))
  )
  .withDocuments([
    'https://aws.amazon.com/builders-library/dependency-isolation/',
    's3://my-bucket/my-document.json'
  ])
  .build();
```

When specifying documents, the scheduler will attempt to infer their mime-type automatically. In the previous example, the scheduler would send a document with a mime-type of `text/html` for the first document, and `application/json` for the second.

<br>

---

### 🏗️ Architecture

The Scheduler trigger uses the [AWS EventBridge Scheduler](https://aws.amazon.com/fr/blogs/compute/introducing-amazon-eventbridge-scheduler/) service to trigger a Lambda function. The Lambda function publishes the appropriate document to its output topic to be consumed by the next middleware in the pipeline.

![Architecture](../../../assets/scheduler-event-trigger-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

*This middleware does not accept any inputs from other middlewares.*

##### Supported Outputs

| Mime Type | Description |
| --------- | ----------- |
| *Variant* | When specifying documents to the Scheduler, it will attempt to infer the mime-types associated with these documents. If no documents are specified, the Scheduler will send a placeholder document to the next middlewares having a mime-type of `application/json+scheduler`. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware is based on a Lambda architecture. |

<br>

---

### 📖 Examples

- [Article Curation Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/article-curation-pipeline) - Builds a pipeline converting HTML articles into plain text.
