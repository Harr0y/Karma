// Skills Parser Tests
import { describe, it, expect } from 'vitest';
import { parseSkillFile, validateFrontmatter } from '@/skills/parser';

describe('Skills Parser', () => {
  describe('parseSkillFile', () => {
    it('should parse valid skill file', () => {
      const content = `---
name: cold-reading
description: 心理冷读技术
---

# 心理冷读技能

## 12 阶段断言速查表
...`;

      const result = parseSkillFile(content, '/path/to/SKILL.md', 'global');

      expect(result.skill).not.toBeNull();
      expect(result.skill?.name).toBe('cold-reading');
      expect(result.skill?.description).toBe('心理冷读技术');
      expect(result.skill?.body).toContain('# 心理冷读技能');
      expect(result.skill?.disableModelInvocation).toBe(false);
    });

    it('should parse skill with disable-model-invocation', () => {
      const content = `---
name: secret-skill
description: Secret skill
disable-model-invocation: true
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md', 'global');

      expect(result.skill?.disableModelInvocation).toBe(true);
    });

    it('should return error for missing name', () => {
      const content = `---
description: Missing name
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md', 'global');

      expect(result.skill).toBeNull();
      expect(result.error).toContain('name');
    });

    it('should return error for missing description', () => {
      const content = `---
name: test-skill
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md', 'global');

      expect(result.skill).toBeNull();
      expect(result.error).toContain('description');
    });

    it('should return error for empty file', () => {
      const result = parseSkillFile('', '/path/to/SKILL.md', 'global');

      expect(result.skill).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('should return error for file without frontmatter', () => {
      const content = `# Just a heading\n\nNo frontmatter here.`;

      const result = parseSkillFile(content, '/path/to/SKILL.md', 'global');

      expect(result.skill).toBeNull();
      expect(result.error).toContain('frontmatter');
    });

    it('should set correct source', () => {
      const content = `---
name: test-skill
description: Test
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md', 'project');

      expect(result.skill?.source).toBe('project');
    });
  });

  describe('validateFrontmatter', () => {
    it('should validate complete frontmatter', () => {
      const frontmatter = {
        name: 'test-skill',
        description: 'Test description',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.name).toBe('test-skill');
      }
    });

    it('should reject missing name', () => {
      const frontmatter = {
        description: 'No name',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject empty name', () => {
      const frontmatter = {
        name: '',
        description: 'Empty name',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid name with spaces', () => {
      const frontmatter = {
        name: 'Invalid Name',
        description: 'Has spaces',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid name with special characters', () => {
      const frontmatter = {
        name: 'invalid!@#$',
        description: 'Special chars',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject name starting with hyphen', () => {
      const frontmatter = {
        name: '-invalid',
        description: 'Starts with hyphen',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject name ending with hyphen', () => {
      const frontmatter = {
        name: 'invalid-',
        description: 'Ends with hyphen',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject name with consecutive hyphens', () => {
      const frontmatter = {
        name: 'invalid--name',
        description: 'Consecutive hyphens',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should accept valid hyphenated name', () => {
      const frontmatter = {
        name: 'valid-skill-name',
        description: 'Valid name',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(true);
    });

    it('should accept name with numbers', () => {
      const frontmatter = {
        name: 'skill-123',
        description: 'With numbers',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(true);
    });

    it('should reject description exceeding 1024 characters', () => {
      const frontmatter = {
        name: 'test-skill',
        description: 'a'.repeat(1025),
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('1024');
    });
  });
});
