// Bazi Calculator - 八字排盘工具
// 使用 lunar-javascript 库进行八字计算

import { Solar, Lunar } from 'lunar-javascript';

export interface BaziInput {
  birthDate?: string; // ISO 格式公历日期或中文格式
  birthPlace?: string;
  gender: 'male' | 'female';
}

export interface Pillar {
  stem: string; // 天干
  branch: string; // 地支
}

export interface DayunItem {
  age: number;
  stem: string;
  branch: string;
}

export interface LiunianItem {
  year: number;
  stem: string;
  branch: string;
}

export interface BaziResult {
  yearPillar: Pillar; // 年柱
  monthPillar: Pillar; // 月柱
  dayPillar: Pillar; // 日柱
  hourPillar: Pillar; // 时柱
  dayun: DayunItem[]; // 大运
  liunian: LiunianItem[]; // 流年
  nayin: string; // 纳音
}

/**
 * 中文数字映射表
 */
const CHINESE_NUM_MAP: Record<string, number> = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1,
  '二': 2, '贰': 2, '两': 2,
  '三': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
  '十': 10, '拾': 10,
  '十一': 11, '十二': 12,
};

/**
 * 将中文数字转换为阿拉伯数字
 * 支持：一、二、三...十一、十二，以及组合如"二十三"
 */
function chineseToArabic(str: string): number | null {
  // 如果已经是数字，直接返回
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // 直接匹配简单中文数字
  if (CHINESE_NUM_MAP[str] !== undefined) {
    return CHINESE_NUM_MAP[str];
  }

  // 处理组合数字如"二十三"、"十五"
  let result = 0;
  let i = 0;

  while (i < str.length) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (char === '十' || char === '拾') {
      // 如果"十"在开头或前面没有数字，表示10
      if (result === 0) {
        result = 10;
      } else {
        // 否则是乘数，如"二十" = 2 * 10
        result *= 10;
      }
      // 检查后面是否还有个位数
      if (nextChar && CHINESE_NUM_MAP[nextChar] !== undefined && nextChar !== '十') {
        result += CHINESE_NUM_MAP[nextChar];
        i += 2;
        continue;
      }
    } else if (CHINESE_NUM_MAP[char] !== undefined) {
      if (nextChar === '十' || nextChar === '拾') {
        // 如"二十"，先记下十位数
        result = CHINESE_NUM_MAP[char] * 10;
        i += 2;
        // 检查是否还有个位
        if (i < str.length && CHINESE_NUM_MAP[str[i]] !== undefined && str[i] !== '十') {
          result += CHINESE_NUM_MAP[str[i]];
        }
        continue;
      }
      result = CHINESE_NUM_MAP[char];
    }
    i++;
  }

  return result > 0 ? result : null;
}

/**
 * 农历月份名称映射
 */
const LUNAR_MONTH_MAP: Record<string, number> = {
  '正月': 1, '一月': 1,
  '二月': 2, '三月': 3, '四月': 4, '五月': 5, '六月': 6,
  '七月': 7, '八月': 8, '九月': 9, '十月': 10,
  '十一月': 11, '冬月': 11, '腊月': 12, '十二月': 12,
};

/**
 * 解析农历日期字符串
 * 支持格式：1990年农历三月初八、庚午年八月十七
 */
function parseLunarDate(dateStr: string): { year: number; month: number; day: number } | null {
  // 匹配农历格式：1990年农历三月初八 或 1990年阴历3月8
  const lunarMatch = dateStr.match(/(\d{4})年(?:农历|阴历|旧历)([一二三四五六七八九十\d]+)月([一二三四五六七八九十\d]+)/);
  if (lunarMatch) {
    const year = parseInt(lunarMatch[1], 10);
    const month = chineseToArabic(lunarMatch[2]) || parseInt(lunarMatch[2], 10);
    const day = chineseToArabic(lunarMatch[3]) || parseInt(lunarMatch[3], 10);
    return { year, month, day };
  }

  // 匹配腊月/正月等特殊月份
  const specialMonthMatch = dateStr.match(/(\d{4})年(?:农历|阴历)?(腊月|正月|冬月)([一二三四五六七八九十\d]+)/);
  if (specialMonthMatch) {
    const year = parseInt(specialMonthMatch[1], 10);
    const month = LUNAR_MONTH_MAP[specialMonthMatch[2]];
    const day = chineseToArabic(specialMonthMatch[3]) || parseInt(specialMonthMatch[3], 10);
    if (month) {
      return { year, month, day };
    }
  }

  return null;
}

/**
 * 解析出生日期字符串
 */
export function parseBirthDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // 尝试 ISO 格式
  const isoDate = Date.parse(dateStr);
  if (!isNaN(isoDate)) {
    return new Date(isoDate);
  }

  // 尝试农历格式
  const lunarInfo = parseLunarDate(dateStr);
  if (lunarInfo) {
    try {
      // 使用 lunar-javascript 将农历转换为公历
      const lunar = Lunar.fromYmd(lunarInfo.year, lunarInfo.month, lunarInfo.day);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const solar = (lunar as any).getSolar();
      return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), 12, 0, 0);
    } catch (e) {
      // 农历转换失败，继续尝试其他格式
    }
  }

  // 尝试中文格式：1990年5月15日早上6点 或 早晨五点钟
  // 支持阿拉伯数字和中文数字
  const chineseMatch = dateStr.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:([上下]午|早上?|下午|晚上?|中午|凌晨)?([零一二三四五六七八九十\d]+)[点时])?/
  );
  if (chineseMatch) {
    const year = parseInt(chineseMatch[1], 10);
    const month = parseInt(chineseMatch[2], 10) - 1; // 0-indexed
    const day = parseInt(chineseMatch[3], 10);

    // 解析小时（支持中文数字）
    let hour = 12; // 默认中午
    if (chineseMatch[5]) {
      const parsedHour = chineseToArabic(chineseMatch[5]);
      if (parsedHour !== null && parsedHour >= 0 && parsedHour <= 23) {
        hour = parsedHour;
      }
    }

    // 处理上午/下午
    const period = chineseMatch[4];
    if (period && (period.includes('下') || period.includes('晚'))) {
      if (hour < 12) hour += 12;
    }
    // 凌晨/早上保持原样（已经是24小时制）

    return new Date(year, month, day, hour, 0, 0);
  }

  return null;
}

/**
 * 计算八字
 */
export async function calculateBazi(input: BaziInput): Promise<BaziResult> {
  if (!input.birthDate) {
    throw new Error('birthDate is required');
  }

  const birthDate = parseBirthDate(input.birthDate);
  if (!birthDate) {
    throw new Error(`Invalid birth date: ${input.birthDate}`);
  }

  // 使用 lunar-javascript 计算
  const solar = Solar.fromDate(birthDate);
  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();

  // 获取四柱
  const yearPillar: Pillar = {
    stem: bazi.getYearGan(),
    branch: bazi.getYearZhi(),
  };

  const monthPillar: Pillar = {
    stem: bazi.getMonthGan(),
    branch: bazi.getMonthZhi(),
  };

  const dayPillar: Pillar = {
    stem: bazi.getDayGan(),
    branch: bazi.getDayZhi(),
  };

  const hourPillar: Pillar = {
    stem: bazi.getTimeGan(),
    branch: bazi.getTimeZhi(),
  };

  // 获取大运
  const genderNum = input.gender === 'male' ? 1 : 0;
  const yun = bazi.getYun(genderNum);
  const dayunList = yun.getDaYun();

  const dayun: DayunItem[] = dayunList.slice(0, 8).map((d: any, i: number) => {
    const ganZhi = d.getGanZhi();
    return {
      age: d.getStartAge() + i * 10,
      stem: ganZhi.substring(0, 1),
      branch: ganZhi.substring(1),
    };
  });

  // 获取流年（未来10年）
  const currentYear = new Date().getFullYear();
  const liunian: LiunianItem[] = [];

  for (let i = 0; i < 10; i++) {
    const year = currentYear + i;
    const yearSolar = Solar.fromDate(new Date(year, 0, 1));
    const yearLunar = yearSolar.getLunar();
    const yearGanZhi = yearLunar.getYearInGanZhi();

    liunian.push({
      year,
      stem: yearGanZhi.substring(0, 1),
      branch: yearGanZhi.substring(1),
    });
  }

  // 获取纳音
  const nayin = bazi.getYearNaYin();

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    dayun,
    liunian,
    nayin,
  };
}

/**
 * 格式化八字结果为可读文本
 */
export function formatBaziResult(result: BaziResult): string {
  const lines: string[] = [
    `年柱：${result.yearPillar.stem}${result.yearPillar.branch}`,
    `月柱：${result.monthPillar.stem}${result.monthPillar.branch}`,
    `日柱：${result.dayPillar.stem}${result.dayPillar.branch}`,
    `时柱：${result.hourPillar.stem}${result.hourPillar.branch}`,
    `纳音：${result.nayin}`,
  ];

  if (result.dayun.length > 0) {
    lines.push('', '大运：');
    for (const d of result.dayun) {
      lines.push(`  ${d.age}岁起：${d.stem}${d.branch}`);
    }
  }

  if (result.liunian.length > 0) {
    lines.push('', '近年流年：');
    for (const l of result.liunian.slice(0, 5)) {
      lines.push(`  ${l.year}年：${l.stem}${l.branch}`);
    }
  }

  return lines.join('\n');
}
