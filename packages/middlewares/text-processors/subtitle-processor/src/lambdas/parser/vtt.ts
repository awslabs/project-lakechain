import webvtt from 'node-webvtt';

/**
 * Converts the number of seconds relative to the start of the video
 * to a VTT time format.
 * @param seconds the number of seconds relative to the start of the video.
 * @returns a string representing the VTT time format.
 */
const secondsToVttTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secondsPart = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  // Format each part to ensure it has the correct number of digits
  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = secondsPart.toString().padStart(2, '0');
  const millisecondsStr = milliseconds.toString().padStart(3, '0');

  // Construct and return the VTT time format
  return (`${hoursStr}:${minutesStr}:${secondsStr}.${millisecondsStr}`);
};

/**
 * Converts a VTT file to a plain text file.
 * @param vtt the VTT file to convert.
 * @returns a plain text file.
 */
export const vttToText = (vtt: string): string => {
  const parsed = webvtt.parse(vtt);

  return (parsed.cues.reduce((acc: string, item: any, idx: number) => {
    const text: string = acc + item.text;
    return (idx < parsed.cues.length - 1) ? text + '\r\n\r\n' : text;
  }, ''));
};

/**
 * Converts a VTT file to a structured JSON string describing
 * the content of the VTT file.
 * @param vtt the VTT file to convert.
 * @returns a JSON string representing the VTT file.
 */
export const vttToJson = (vtt: string): string => {
  const parsed = webvtt.parse(vtt);

  return (JSON.stringify(
    parsed.cues.map((item: any) => {
      return ({
        id: item.identifier,
        startTime: secondsToVttTime(item.start),
        startSeconds: item.start,
        endTime: secondsToVttTime(item.end),
        endSeconds: item.end,
        text: item.text,
      });
    })
  ));
};
