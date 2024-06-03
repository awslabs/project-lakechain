import {
  CloudEvent,
  FfmpegUtils,
  Ffmpeg
} from '@project-lakechain/ffmpeg-processor';

/**
 * This intent is a function that will get executed in the cloud
 * by the FFMPEG middleware. It takes a video input and extracts
 * the audio from it.
 * @param events the events to process, in this case there will
 * be only one event, as video files are processed sequentially.
 * @param ffmpeg the FFMPEG instance.
 * @param utils a set of utilities to interact with the FFMPEG
 * middleware.
 * @returns the FFMPEG chain.
 */
export const audioExtraction = async (events: CloudEvent[], ffmpeg: Ffmpeg, utils: FfmpegUtils) => {
  const videos = events.filter(
    (event) => event.data().document().mimeType() === 'video/mp4'
  );

  // Create the FFMPEG chain.
  return (ffmpeg()
    .input(utils.file(videos[0]))
    .noVideo()
    .save('output.mp3')
  );
};

/**
 * This function describes the intent definition which is called
 * back the FFMPEG middleware when handling subtitles and a video.
 * It will merge the subtitles with the video according to their
 * associated language.
 * @param events the input events.
 * @param ffmpeg the FFMPEG instance.
 * @param utils a set of utilities provided by the middleware.
 * @returns the FFMPEG instance.
 */
export const merge = async (events: CloudEvent[], ffmpeg: Ffmpeg, utils: FfmpegUtils) => {
  const video = events.find((event) => event.data().document().mimeType() === 'video/mp4');
  const subs  = events.filter((event) => event.data().document().mimeType() === 'application/x-subrip');
  
  /**
   * A mapping between ISO 639-1 and ISO 639-2 language codes
   * which are expected by FFMPEG.
   * @note this mapping is not exhaustive and only contains
   * the most common languages.
   */
  const mapping: { [key: string]: string } = {
    'ar': 'ara',
    'en': 'eng',
    'es': 'spa',
    'fr': 'fra',
    'de': 'deu',
    'it': 'ita',
    'ja': 'jpn',
    'ko': 'kor',
    'pt': 'por',
    'ru': 'rus',
    'tr': 'tur',
    'zh': 'chi'
  };

  try {
    // We check if the input events are valid.
    if (!video || !subs) {
      throw new Error('The input events are not valid');
    }

    // Create the FFMPEG chain with the video.
    let chain = ffmpeg(utils.file(video))
      .outputOption('-map 0')
      .outputOption('-c copy')
      .outputOption('-c:s mov_text');

    // Add each subtitle to the video.
    subs.forEach((subtitle, index) => {
      const metadata = subtitle.data().metadata();

      if (metadata.properties?.kind === 'text') {
        const language = mapping[metadata.language as string];

        if (language) {
          chain = chain
            .input(utils.file(subtitle))
            .outputOption(`-map ${index + 1}`)
            .outputOption(`-metadata:s:s:${index} language=${language}`);
        }
      }
    });

    // Write the video with the subtitles.
    return (chain.save('output.mp4'));
  } catch (err) {
    console.error(err);
    throw err;
  }
};
