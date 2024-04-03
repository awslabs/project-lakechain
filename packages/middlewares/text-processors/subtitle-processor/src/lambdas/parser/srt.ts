import srtParser2 from 'srt-parser-2';

/**
 * Converts a SRT file to a plain text file.
 * @param srt the SRT file to convert.
 * @returns a plain text file.
 */
export const srtToText = (srt: string): string => {
  const parser = new srtParser2();
  const parsed = parser.fromSrt(srt);

  return (parsed.reduce((acc: string, item: any, idx: number) => {
    const text: string = acc + item.text;
    return (idx < parsed.length - 1) ? text + '\r\n\r\n' : text;
  }, ''));
};

/**
 * Converts a SRT file to a structured JSON string describing
 * the content of the SRT file.
 * @param srt the SRT file to convert.
 * @returns a JSON string representing the SRT file.
 */
export const srtToJson = (srt: string): string => {
  return (JSON.stringify(new srtParser2().fromSrt(srt)));
};
