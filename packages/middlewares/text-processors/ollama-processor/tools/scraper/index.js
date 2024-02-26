import { PlaywrightCrawler, Dataset } from 'crawlee';

/**
 * An aggregate state used to store the model and their
 * associated tags information.
 */
const state = {};

/**
 * Called back when the crawler is on the model list page.
 * @param {*} param properties provides by the crawler.
 * @returns {Promise} a promise that resolves when the crawling and
 * the enqueueing of the links is done.
 * @see https://ollama.com/library
 */
const onList = async ({ page, enqueueLinks }) => {
  let models = await page.locator('li').all();

  // For each model, we enqueue its page.
  for (const element of models) {
    const data = {
      tags: {}
    };

    // Model name.
    data.name = (await (await element.locator('h2').first()).textContent()).trim();

    // Model link.
    data.link = (await (await element.locator('a').first()).getAttribute('href')).trim();

    // Model description.
    data.description = (await (await element.locator('p.mb-4').first()).textContent()).trim();

    await enqueueLinks({
      urls: [`${data.link}/tags`],
      userData: data,
      label: 'MODEL_TAGS'
    });
  }
};

/**
 * Called back when the crawler is on a model tag list page.
 * @param {*} param properties provides by the crawler.
 * @returns {Promise} a promise that resolves when the crawling and
 * metadata extraction of the article is done.
 * @see https://ollama.com/{model}/tags
 */
const onModelTagListPage = async ({ request, page, log, enqueueLinks }) => {
  let tags = await page.locator('section.w-full > .flex > .flex-1').all();

  state[request.userData.name] = request.userData;
  state[request.userData.name].totalTags = tags.length;
  state[request.userData.name].processedTags = 0;

  log.info(`Extracting model information '${request.userData.name}' ...`);
  for (const tag of tags) {
    const info = {};

    // The tag link.
    const link = await (await tag.locator('a.group').first()).getAttribute('href');
    info.link = `https://ollama.com${link}`;

    // The tag name.
    info.name = (await (await tag.locator('.break-all').first()).textContent()).trim();

    // Add tag information to the model data.
    request.userData.tags[info.name] = info;
    state[request.userData.name].tags[info.name] = info;

    await enqueueLinks({
      urls: [info.link],
      userData: request.userData,
      label: 'TAG'
    });
  }
};

/**
 * Called back when the crawler is on a model tag page.
 * @param {*} param properties provides by the crawler.
 * @returns {Promise} a promise that resolves when the crawling and
 * metadata extraction of the tag is done.
 * @see https://ollama.com/{tag}
 */
const onModelTagPage = async ({ request, page }) => {
  // The name of the tag.
  const name = (await (await page.locator('select option[selected]').first()).textContent()).trim();
  let id, family, parameters;

  const details = await page.locator('.py-6 > .block > div > p').all();

  for (const [idx, el] of details.entries()) {
    if (idx === 1) {
      id = await el.textContent();
    } else if (idx === 3) {
      family = await el.textContent();
    } else if (idx === 5) {
      parameters = await el.textContent();
    }
  }

  Object.assign(state[request.userData.name].tags[name], {
    id,
    family,
    parameters
  });

  state[request.userData.name].processedTags++;

  // When all tags for a model have been resolved,
  // we push the data to the dataset.
  if (state[request.userData.name].processedTags === state[request.userData.name].totalTags) {
    await Dataset.pushData(state[request.userData.name]);
  }
};

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
const crawler = new PlaywrightCrawler({
  minConcurrency: 5,
  maxConcurrency: 10,
  async requestHandler(req) {
    if (req.request.label === 'LIST' || !req.request.label) {
      await onList(req);
    } else if (req.request.label === 'MODEL_TAGS') {
      await onModelTagListPage(req);
    } else if (req.request.label === 'TAG') {
      await onModelTagPage(req);
    }
  }
});

// Add first URL to the queue and start the crawl.
await crawler.run(['https://ollama.com/library']);
