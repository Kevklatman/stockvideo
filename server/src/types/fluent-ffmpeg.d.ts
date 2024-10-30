// src/types/fluent-ffmpeg.d.ts
declare module 'fluent-ffmpeg' {
  import { Stream } from 'stream';

  interface FfprobeData {
    streams: any[];
    format: {
      duration?: number;
      size?: number;
      bit_rate?: number;
      format_name?: string;
    };
  }

  interface FfmpegCommandOptions {
    end?: boolean;
    error?: boolean;
    progress?: boolean;
  }

  interface ScreenshotsConfig {
    count?: number;
    filename?: string;
    folder?: string;
    size?: string;
    timestamps?: number[] | string[];
  }

  interface AudioVideoFilter {
    filter: string;
    options: string[] | string;
  }

  class FfmpegCommand {
    constructor(options?: any);
    
    // Input options
    input(source: string | Stream): FfmpegCommand;
    mergeAdd(source: string | Stream): FfmpegCommand;
    inputOptions(options: string[]): FfmpegCommand;
    
    // Output options
    output(destination: string | Stream, options?: any): FfmpegCommand;
    outputOptions(options: string[]): FfmpegCommand;
    
    // Video options
    withVideoCodec(codec: string): FfmpegCommand;
    withVideoBitrate(bitrate: number | string): FfmpegCommand;
    videoCodec(codec: string): FfmpegCommand;
    videoBitrate(bitrate: number | string): FfmpegCommand;
    size(size: string): FfmpegCommand;
    
    // Audio options
    withAudioCodec(codec: string): FfmpegCommand;
    withAudioBitrate(bitrate: number | string): FfmpegCommand;
    audioCodec(codec: string): FfmpegCommand;
    audioBitrate(bitrate: number | string): FfmpegCommand;
    
    // Additional options
    addOption(option: string, value: string | number): FfmpegCommand;
    addOptions(options: string[]): FfmpegCommand;
    addInputOption(option: string, value: string | number): FfmpegCommand;
    addInputOptions(options: string[]): FfmpegCommand;
    addOutputOption(option: string, value: string | number): FfmpegCommand;
    addOutputOptions(options: string[]): FfmpegCommand;
    
    // Processing options
    duration(duration: number): FfmpegCommand;
    seekInput(time: string | number): FfmpegCommand;
    seek(time: string | number): FfmpegCommand;
    fps(fps: number): FfmpegCommand;
    frames(frames: number): FfmpegCommand;
    
    // Filters
    videoFilters(filters: string | string[] | AudioVideoFilter | AudioVideoFilter[]): FfmpegCommand;
    audioFilters(filters: string | string[] | AudioVideoFilter | AudioVideoFilter[]): FfmpegCommand;
    complexFilter(filters: string | string[] | AudioVideoFilter | AudioVideoFilter[]): FfmpegCommand;
    
    // Screenshot options
    screenshots(config: ScreenshotsConfig): FfmpegCommand;
    thumbnail(config: ScreenshotsConfig): FfmpegCommand;
    
    // Event handlers
    on(event: 'start', callback: (commandLine: string) => void): FfmpegCommand;
    on(event: 'end', callback: (stdout?: string | null, stderr?: string | null) => void): FfmpegCommand;    on(event: 'error', callback: (err: Error, stdout: string, stderr: string) => void): FfmpegCommand;
    on(event: 'progress', callback: (progress: any) => void): FfmpegCommand;
    
    // Running methods
    run(): void;
    save(output: string): void;
    pipe(stream: Stream, options?: { end?: boolean }): Stream;

    // Format options
    format(format: string): FfmpegCommand;
    toFormat(format: string): FfmpegCommand;

    // Setup options
    setFfmpegPath(path: string): FfmpegCommand;
    setFfprobePath(path: string): FfmpegCommand;
    setFlvtoolPath(path: string): FfmpegCommand;
    
    // Miscellaneous
    preset(preset: string): FfmpegCommand;
    aspect(aspect: string | number): FfmpegCommand;
    autopad(pad?: boolean, color?: string): FfmpegCommand;
    keepDAR(): FfmpegCommand;
    native(): FfmpegCommand;
  }

  interface FfmpegStatic {
    (options?: any): FfmpegCommand;
    (input?: string | Stream, options?: any): FfmpegCommand;

    setFfmpegPath(path: string): FfmpegStatic;
    setFfprobePath(path: string): FfmpegStatic;
    
    ffprobe(file: string | Stream, callback: (err: Error, data: FfprobeData) => void): void;
    ffprobe(file: string | Stream, index: number, callback: (err: Error, data: FfprobeData) => void): void;
    ffprobe(file: string | Stream, options: string[], callback: (err: Error, data: FfprobeData) => void): void;
  }

  const ffmpeg: FfmpegStatic;
  export = ffmpeg;
}