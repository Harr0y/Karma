// Skills Formatter Tests
import { describe, it, expect } from 'vitest';
import { formatSkillsForPrompt, getVisibleSkills } from '@/skills/formatter';
import type { Skill } from '@/skills/types';

describe('Skills Formatter', () => {
  const mockSkills: Skill[] = [
    {
      name: 'cold-reading',
      description: '心理冷读技术',
      filePath: '/skills/cold-reading/SKILL.md',
      content: '---\nname: cold-reading\n---\nContent',
      body: 'Content',
      disableModelInvocation: false,
      source: 'global',
    },
    {
      name: 'secret-skill',
      description: 'Secret skill',
      filePath: '/skills/secret-skill/SKILL.md',
      content: '---\nname: secret-skill\n---\nContent',
      body: 'Content',
      disableModelInvocation: true,
      source: 'global',
    },
  ];

  describe('getVisibleSkills', () => {
    it('should filter out skills with disableModelInvocation=true', () => {
      const visible = getVisibleSkills(mockSkills);

      expect(visible.length).toBe(1);
      expect(visible[0].name).toBe('cold-reading');
    });

    it('should return all skills if none are disabled', () => {
      const allEnabled = mockSkills.map(s => ({
        ...s,
        disableModelInvocation: false,
      }));

      const visible = getVisibleSkills(allEnabled);

      expect(visible.length).toBe(2);
    });

    it('should return empty array if all skills are disabled', () => {
      const allDisabled = mockSkills.map(s => ({
        ...s,
        disableModelInvocation: true,
      }));

      const visible = getVisibleSkills(allDisabled);

      expect(visible).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      const visible = getVisibleSkills([]);
      expect(visible).toEqual([]);
    });
  });

  describe('formatSkillsForPrompt', () => {
    it('should generate XML format prompt', () => {
      const visible = getVisibleSkills(mockSkills);
      const prompt = formatSkillsForPrompt(visible);

      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('</available_skills>');
      expect(prompt).toContain('<skill>');
      expect(prompt).toContain('</skill>');
    });

    it('should include skill name and description', () => {
      const prompt = formatSkillsForPrompt([mockSkills[0]]);

      expect(prompt).toContain('cold-reading');
      expect(prompt).toContain('心理冷读技术');
    });

    it('should include skill location', () => {
      const prompt = formatSkillsForPrompt([mockSkills[0]]);

      expect(prompt).toContain('/skills/cold-reading/SKILL.md');
    });

    it('should return empty string for empty skills', () => {
      const prompt = formatSkillsForPrompt([]);

      expect(prompt).toBe('');
    });

    it('should include instruction to use Read tool', () => {
      const prompt = formatSkillsForPrompt([mockSkills[0]]);

      expect(prompt.toLowerCase()).toContain('read');
    });

    it('should escape XML special characters in name', () => {
      const skillWithSpecialChars: Skill = {
        name: 'skill-with-ampersand',
        description: 'Test <&>',
        filePath: '/path/with<&>/SKILL.md',
        content: '',
        body: '',
        disableModelInvocation: false,
        source: 'global',
      };

      const prompt = formatSkillsForPrompt([skillWithSpecialChars]);

      expect(prompt).toContain('&lt;');
      expect(prompt).toContain('&gt;');
      expect(prompt).toContain('&amp;');
    });

    it('should filter out disabled skills', () => {
      const prompt = formatSkillsForPrompt(mockSkills);

      expect(prompt).toContain('cold-reading');
      expect(prompt).not.toContain('secret-skill');
    });

    it('should format multiple skills', () => {
      const skills: Skill[] = [
        { ...mockSkills[0], disableModelInvocation: false },
        { ...mockSkills[0], name: 'skill-two', description: 'Second skill', disableModelInvocation: false },
      ];

      const prompt = formatSkillsForPrompt(skills);

      expect(prompt).toContain('cold-reading');
      expect(prompt).toContain('skill-two');
    });
  });
});
