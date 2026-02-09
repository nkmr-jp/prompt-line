import { describe, test, expect } from '@jest/globals';
import {
  resolveTemplate,
  getBasename,
  getDirname,
  parseFrontmatter,
  extractRawFrontmatter
} from '../../src/lib/template-resolver';

describe('resolveTemplate', () => {
  describe('basic variable replacement', () => {
    test('{basename}を置換できる', () => {
      const template = '{basename}';
      const context = {
        basename: 'my-command',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('my-command');
    });

    test('{frontmatter@field}を置換できる', () => {
      const template = 'agent-{frontmatter@name}';
      const context = {
        basename: 'agent',
        frontmatter: { name: 'helper' }
      };
      expect(resolveTemplate(template, context)).toBe('agent-helper');
    });

    test('複数の変数を同時に置換できる', () => {
      const template = '{basename}-{frontmatter@type}';
      const context = {
        basename: 'test',
        frontmatter: { type: 'command' }
      };
      expect(resolveTemplate(template, context)).toBe('test-command');
    });
  });

  describe('resolveTemplate with prefix', () => {
    test('{prefix}を置換できる', () => {
      const template = '{prefix}:{basename}';
      const context = {
        prefix: 'foo',
        basename: 'hello',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('foo:hello');
    });

    test('prefixがundefinedの場合は{prefix}をそのまま残す', () => {
      const template = '{prefix}:{basename}';
      const context = {
        basename: 'hello',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('{prefix}:hello');
    });

    test('prefixが空文字列の場合は空に置換する', () => {
      const template = '{prefix}:{basename}';
      const context = {
        prefix: '',
        basename: 'hello',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe(':hello');
    });

    test('複数の{prefix}を全て置換できる', () => {
      const template = '{prefix}-{basename}-{prefix}';
      const context = {
        prefix: 'test',
        basename: 'file',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('test-file-test');
    });
  });

  describe('resolveTemplate with dirname', () => {
    test('{dirname}を置換できる', () => {
      const template = '{dirname}/{basename}';
      const context = {
        basename: 'hello',
        dirname: 'commands',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('commands/hello');
    });

    test('dirnameがundefinedの場合は{dirname}をそのまま残す', () => {
      const template = '{dirname}/{basename}';
      const context = {
        basename: 'hello',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('{dirname}/hello');
    });

    test('dirnameが空文字列の場合は空に置換する', () => {
      const template = '{dirname}/{basename}';
      const context = {
        basename: 'hello',
        dirname: '',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('/hello');
    });

    test('複数の{dirname}を全て置換できる', () => {
      const template = '{dirname}-{basename}-{dirname}';
      const context = {
        basename: 'file',
        dirname: 'agents',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('agents-file-agents');
    });
  });

  describe('edge cases', () => {
    test('存在しないfrontmatterフィールドは空文字に置換される', () => {
      const template = '{frontmatter@missing}';
      const context = {
        basename: 'test',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('');
    });

    test('変数がない場合はテンプレートをそのまま返す', () => {
      const template = 'no-variables';
      const context = {
        basename: 'test',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('no-variables');
    });

    test('すべての変数タイプを組み合わせて使用できる', () => {
      const template = '{prefix}/{dirname}/{basename}/{frontmatter@type}';
      const context = {
        prefix: 'app',
        basename: 'command',
        dirname: 'commands',
        frontmatter: { type: 'agent' }
      };
      expect(resolveTemplate(template, context)).toBe('app/commands/command/agent');
    });
  });
});

describe('getBasename', () => {
  test('拡張子を除いたファイル名を取得できる', () => {
    expect(getBasename('/path/to/file.md')).toBe('file');
    expect(getBasename('file.txt')).toBe('file');
    expect(getBasename('/path/with.dots/file.test.js')).toBe('file.test');
  });

  test('拡張子がない場合はファイル名をそのまま返す', () => {
    expect(getBasename('/path/to/filename')).toBe('filename');
    expect(getBasename('filename')).toBe('filename');
  });

  test('空のパスは空文字列を返す', () => {
    expect(getBasename('')).toBe('');
  });
});

describe('getDirname', () => {
  test('親ディレクトリ名を取得できる', () => {
    expect(getDirname('/path/to/file.md')).toBe('to');
    expect(getDirname('/commands/my-command.md')).toBe('commands');
    expect(getDirname('/a/b/c/file.txt')).toBe('c');
  });

  test('ファイル名のみの場合は空文字列を返す', () => {
    expect(getDirname('filename')).toBe('');
    expect(getDirname('file.md')).toBe('');
  });

  test('空のパスは空文字列を返す', () => {
    expect(getDirname('')).toBe('');
  });
});

describe('parseFrontmatter', () => {
  test('基本的なfrontmatterを解析できる', () => {
    const content = `---
name: my-agent
type: helper
---
content here`;
    expect(parseFrontmatter(content)).toEqual({
      name: 'my-agent',
      type: 'helper'
    });
  });

  test('クォート付きの値を正しく解析できる', () => {
    const content = `---
name: "quoted name"
type: 'single quoted'
---`;
    expect(parseFrontmatter(content)).toEqual({
      name: 'quoted name',
      type: 'single quoted'
    });
  });

  test('frontmatterがない場合は空オブジェクトを返す', () => {
    const content = 'no frontmatter here';
    expect(parseFrontmatter(content)).toEqual({});
  });

  test('空のfrontmatterの場合は空オブジェクトを返す', () => {
    const content = `---
---
content`;
    expect(parseFrontmatter(content)).toEqual({});
  });
});

describe('extractRawFrontmatter', () => {
  test('frontmatterの生テキストを取得できる', () => {
    const content = `---
name: test
type: agent
---
content`;
    expect(extractRawFrontmatter(content)).toBe('name: test\ntype: agent');
  });

  test('frontmatterがない場合は空文字列を返す', () => {
    const content = 'no frontmatter';
    expect(extractRawFrontmatter(content)).toBe('');
  });

  test('空のfrontmatterの場合は空文字列を返す', () => {
    const content = `---
---
content`;
    expect(extractRawFrontmatter(content)).toBe('');
  });
});
