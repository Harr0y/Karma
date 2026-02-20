// Type declarations for modules without TypeScript support

declare module 'lunar-javascript' {
  export class Solar {
    static fromDate(date: Date): Solar;
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export class Lunar {
    static fromDate(date: Date): Lunar;
    static fromYmd(year: number, month: number, day: number): Lunar;
    getYearInChinese(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getYearShengXiao(): string;
    getYearInGanZhi(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getJieQi(): string;
    getYearEightChar(): EightChar;
    getEightChar(): EightChar;
  }

  export class EightChar {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearGan(): string;
    getYearZhi(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
    getYun(gender: number): Yun;
    getYearNaYin(): string;
  }

  export class Yun {
    getDaYun(): DaYun[];
  }

  export class DaYun {
    getGanZhi(): string;
    getStartAge(): number;
  }
}

declare module 'pino/file' {
  import type { DestinationStream } from 'pino';

  export function destination(file: string): DestinationStream;
}

declare module 'node-fetch' {
  export default function fetch(url: string, init?: RequestInit): Promise<Response>;

  export interface RequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer | ReadableStream;
  }

  export interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    arrayBuffer(): Promise<ArrayBuffer>;
    json(): Promise<unknown>;
    text(): Promise<string>;
  }
}
