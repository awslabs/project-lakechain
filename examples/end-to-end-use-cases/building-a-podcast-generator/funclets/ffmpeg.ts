import { TextMetadata } from '@project-lakechain/sdk';
import {
  CloudEvent,
  FfmpegUtils,
  Ffmpeg
} from '@project-lakechain/ffmpeg-processor';

/**
 * This function describes the intent definition which is called
 * back the FFMPEG middleware when handling documents in the cloud.
 * This function merges all input audio files into a single audio file.
 * @param events the input events.
 * @param ffmpeg the FFMPEG instance.
 * @param utils a set of utilities provided by the middleware.
 * @returns the FFMPEG instance.
 */
export const ffmpegIntent = async (events: CloudEvent[], ffmpeg: Ffmpeg, utils: FfmpegUtils) => {
  // Get all audio files and sort them by chunk order.
  const videos = events
    .filter((event) => event.data().document().mimeType() === 'audio/mpeg')
    .sort((a, b) => {
      const ma = a.data().metadata().properties?.attrs as TextMetadata;
      const mb = b.data().metadata().properties?.attrs as TextMetadata;
      return ((ma.chunk?.order as number) - (mb.chunk?.order as number));
    });
  
  // Create a new FFMPEG instance.
  let chain = ffmpeg();

  // Add all input audio to the chain.
  for (const video of videos) {
    chain = chain.addInput(utils.file(video));
  }
  return (chain.mergeToFile('output.mp3', 'tmp/'));
};
