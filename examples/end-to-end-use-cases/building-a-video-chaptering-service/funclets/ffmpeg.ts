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
 * back the FFMPEG middleware when handling documents in the cloud.
 * This function will use the input events to extract a chapter
 * using the JSON description provided by the LLM.
 * @param events the input events.
 * @param ffmpeg the FFMPEG instance.
 * @param utils a set of utilities provided by the middleware.
 * @returns the FFMPEG instance.
 */
export const shorten = async (events: CloudEvent[], ffmpeg: Ffmpeg, utils: FfmpegUtils) => {
  const video = events.find((event) => event.data().document().mimeType() === 'video/mp4');
  const short = events.find((event) => event.data().document().mimeType() === 'application/json');
  let chain   = ffmpeg();

  /**
   * Converts the given VTT time in 'HH:MM:SS.sss' format to seconds
   * relative to the start of the video.
   * @param time the VTT time to convert.
   * @returns an integer representing the time in seconds relative to
   * the start of the video.
   */
  const vttTimeToSeconds = (time: string) => {
    const parts = time.split(':');
    const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    return (seconds);
  };

  try {
    // We check if the input events are valid.
    if (!video || !short) {
      throw new Error('The input events are not valid');
    }

    // Load the JSON document in memory.
    const description = JSON.parse(
      (await short.data().document().data().asBuffer())?.toString('utf-8') as string
    );

    // For each short moment, we create a short video
    // using the given start and end times. We also
    // resize the video to match the aspect ratio of
    // a short video.
    for (const moment of description) {
      const start = vttTimeToSeconds(moment.start);
      const end = vttTimeToSeconds(moment.end);

      chain = ffmpeg()
        .addInput(utils.file(video))
        .setStartTime(moment.start)
        .setDuration(end - start)
        .save(`${moment.index}-${moment.title}.mp4`)
        .on('end', () => console.log('Chapter created'));
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
  
  return (chain);
};
