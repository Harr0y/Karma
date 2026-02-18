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
 * 解析出生日期字符串
 */
export function parseBirthDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // 尝试 ISO 格式
  const isoDate = Date.parse(dateStr);
  if (!isNaN(isoDate)) {
    return new Date(isoDate);
  }

  // 尝试中文格式：1990年5月15日早上6点
  const chineseMatch = dateStr.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:([上下]午|早上?|下午|晚上?|中午|凌晨)?(\d{1,2})[点时])?/
  );
  if (chineseMatch) {
    const year = parseInt(chineseMatch[1], 10);
    const month = parseInt(chineseMatch[2], 10) - 1; // 0-indexed
    const day = parseInt(chineseMatch[3], 10);
    let hour = chineseMatch[5] ? parseInt(chineseMatch[5], 10) : 12;

    // 处理上午/下午
    const period = chineseMatch[4];
    if (period && (period.includes('下') || period.includes('晚'))) {
      if (hour < 12) hour += 12;
    }
    if (period && (period.includes('凌晨') || period.includes('早'))) {
      // 凌晨保持原样
    }

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
