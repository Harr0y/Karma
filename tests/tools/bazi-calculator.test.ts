// 八字排盘工具测试
// 测试目标：验证八字计算功能

import { describe, it, expect } from 'vitest';
import {
  calculateBazi,
  formatBaziResult,
  parseBirthDate,
  type BaziInput,
} from '@/tools/bazi-calculator.js';

describe('Bazi Calculator', () => {
  describe('parseBirthDate', () => {
    it('should parse ISO date string', () => {
      const result = parseBirthDate('1990-05-15T06:00:00');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(1990);
      expect(result!.getMonth()).toBe(4); // 0-indexed
      expect(result!.getDate()).toBe(15);
      expect(result!.getHours()).toBe(6);
    });

    it('should parse Chinese date format', () => {
      const result = parseBirthDate('1990年5月15日早上6点');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(1990);
    });

    it('should return null for invalid date', () => {
      expect(parseBirthDate('invalid')).toBeNull();
      expect(parseBirthDate('')).toBeNull();
    });
  });

  describe('calculateBazi', () => {
    it('should calculate bazi for known date', async () => {
      const input: BaziInput = {
        birthDate: '1990-05-15T06:00:00',
        birthPlace: '北京',
        gender: 'male',
      };

      const result = await calculateBazi(input);

      expect(result).toBeDefined();
      expect(result.yearPillar).toBeDefined();
      expect(result.monthPillar).toBeDefined();
      expect(result.dayPillar).toBeDefined();
      expect(result.hourPillar).toBeDefined();

      // 四柱应该都是天干+地支
      expect(result.yearPillar.stem).toHaveLength(1);
      expect(result.yearPillar.branch).toHaveLength(1);
      expect(result.monthPillar.stem).toHaveLength(1);
      expect(result.monthPillar.branch).toHaveLength(1);
      expect(result.dayPillar.stem).toHaveLength(1);
      expect(result.dayPillar.branch).toHaveLength(1);
      expect(result.hourPillar.stem).toHaveLength(1);
      expect(result.hourPillar.branch).toHaveLength(1);
    });

    it('should calculate dayun (大运)', async () => {
      const input: BaziInput = {
        birthDate: '1990-05-15T06:00:00',
        birthPlace: '北京',
        gender: 'male',
      };

      const result = await calculateBazi(input);

      expect(result.dayun).toBeDefined();
      expect(result.dayun.length).toBeGreaterThan(0);

      // 大运应该有起运年龄
      expect(result.dayun[0].age).toBeDefined();
      expect(result.dayun[0].stem).toBeDefined();
      expect(result.dayun[0].branch).toBeDefined();
    });

    it('should calculate liunian (流年)', async () => {
      const input: BaziInput = {
        birthDate: '1990-05-15T06:00:00',
        birthPlace: '北京',
        gender: 'male',
      };

      const result = await calculateBazi(input);

      expect(result.liunian).toBeDefined();
      expect(result.liunian.length).toBeGreaterThan(0);

      // 流年应该有年份和干支
      const currentYear = new Date().getFullYear();
      expect(result.liunian[0].year).toBeGreaterThanOrEqual(currentYear);
    });

    it('should handle female gender', async () => {
      const input: BaziInput = {
        birthDate: '1985-03-20T12:00:00',
        birthPlace: '上海',
        gender: 'female',
      };

      const result = await calculateBazi(input);
      expect(result).toBeDefined();
      expect(result.yearPillar).toBeDefined();
    });

    it('should throw error for missing birthDate', async () => {
      const input: BaziInput = {
        birthPlace: '北京',
        gender: 'male',
      };

      await expect(calculateBazi(input)).rejects.toThrow();
    });
  });

  describe('formatBaziResult', () => {
    it('should format bazi result as readable text', () => {
      const result = {
        yearPillar: { stem: '庚', branch: '午' },
        monthPillar: { stem: '辛', branch: '巳' },
        dayPillar: { stem: '甲', branch: '寅' },
        hourPillar: { stem: '丁', branch: '卯' },
        dayun: [
          { age: 2, stem: '壬', branch: '午' },
          { age: 12, stem: '癸', branch: '未' },
        ],
        liunian: [
          { year: 2025, stem: '乙', branch: '巳' },
          { year: 2026, stem: '丙', branch: '午' },
        ],
        nayin: '沙中金',
      };

      const formatted = formatBaziResult(result);

      expect(formatted).toContain('年柱');
      expect(formatted).toContain('庚午');
      expect(formatted).toContain('月柱');
      expect(formatted).toContain('辛巳');
      expect(formatted).toContain('日柱');
      expect(formatted).toContain('甲寅');
      expect(formatted).toContain('时柱');
      expect(formatted).toContain('丁卯');
      expect(formatted).toContain('大运');
      expect(formatted).toContain('流年');
      expect(formatted).toContain('沙中金');
    });

    it('should handle empty dayun/liunian', () => {
      const result = {
        yearPillar: { stem: '甲', branch: '子' },
        monthPillar: { stem: '乙', branch: '丑' },
        dayPillar: { stem: '丙', branch: '寅' },
        hourPillar: { stem: '丁', branch: '卯' },
        dayun: [],
        liunian: [],
        nayin: '海中金',
      };

      const formatted = formatBaziResult(result);
      expect(formatted).toContain('年柱');
      expect(formatted).toContain('甲子');
    });
  });
});
