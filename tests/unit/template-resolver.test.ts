import { describe, test, expect } from '@jest/globals';
import {
  resolveTemplate,
  getBasename,
  getDirname,
  parseFrontmatter,
  extractRawFrontmatter,
  parseFirstHeading
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
    test('{dirname} を解決する', () => {
      expect(resolveTemplate('{dirname}', { basename: 'file', frontmatter: {}, dirname: 'commands' })).toBe('commands');
    });

    test('{dirname} と {basename} を組み合わせて解決する', () => {
      expect(resolveTemplate('{dirname}/{basename}', { basename: 'file', frontmatter: {}, dirname: 'commands' })).toBe('commands/file');
    });

    test('{dirname} が未設定の場合は置換しない', () => {
      expect(resolveTemplate('{dirname}', { basename: 'file', frontmatter: {} })).toBe('{dirname}');
    });

    test('{dirname:2} で2つ上のディレクトリ名を解決する', () => {
      expect(resolveTemplate('{dirname:2}', {
        basename: 'file', frontmatter: {}, filePath: '/a/b/c/d/file.md'
      })).toBe('c');
    });

    test('{dirname:3} で3つ上のディレクトリ名を解決する', () => {
      expect(resolveTemplate('{dirname:3}', {
        basename: 'file', frontmatter: {}, filePath: '/a/b/c/d/file.md'
      })).toBe('b');
    });

    test('{dirname} と {dirname:2} を組み合わせて使用できる', () => {
      expect(resolveTemplate('{dirname:2}/{dirname}', {
        basename: 'file', frontmatter: {}, dirname: 'd', filePath: '/a/b/c/d/file.md'
      })).toBe('c/d');
    });

    test('{dirname:N} で階層が足りない場合は空文字を返す', () => {
      expect(resolveTemplate('{dirname:10}', {
        basename: 'file', frontmatter: {}, filePath: '/a/file.md'
      })).toBe('');
    });
  });

  describe('resolveTemplate with heading', () => {
    test('{heading}を置換できる', () => {
      const template = '{heading}';
      const context = {
        basename: 'test',
        frontmatter: {},
        heading: 'My Document Title'
      };
      expect(resolveTemplate(template, context)).toBe('My Document Title');
    });

    test('headingがundefinedの場合は空文字に置換される', () => {
      const template = '{heading}';
      const context = {
        basename: 'test',
        frontmatter: {}
      };
      expect(resolveTemplate(template, context)).toBe('');
    });

    test('{heading}と他の変数を組み合わせて使用できる', () => {
      const template = '{basename} - {heading}';
      const context = {
        basename: 'doc',
        frontmatter: {},
        heading: 'Introduction'
      };
      expect(resolveTemplate(template, context)).toBe('doc - Introduction');
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
  test('ファイルパスから親ディレクトリ名を取得', () => {
    expect(getDirname('/path/to/commands/my-command.md')).toBe('commands');
  });

  test('ルート直下のファイル', () => {
    expect(getDirname('/file.md')).toBe('');
  });

  test('ファイル名のみ', () => {
    expect(getDirname('file.md')).toBe('');
  });

  test('深いパスでも直接の親ディレクトリ名を返す', () => {
    expect(getDirname('/a/b/c/d/target.md')).toBe('d');
  });

  test('level=2で2つ上のディレクトリ名を返す', () => {
    expect(getDirname('/a/b/c/d/target.md', 2)).toBe('c');
  });

  test('level=3で3つ上のディレクトリ名を返す', () => {
    expect(getDirname('/a/b/c/d/target.md', 3)).toBe('b');
  });

  test('階層が足りない場合は空文字を返す', () => {
    expect(getDirname('/a/file.md', 5)).toBe('');
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

describe('parseFirstHeading', () => {
  test('frontmatter付きコンテンツから最初の#headingを取得できる', () => {
    const content = `---
description: "Some description"
---
# My Document Title

Content here...`;
    expect(parseFirstHeading(content)).toBe('My Document Title');
  });

  test('frontmatterなしのコンテンツから最初の#headingを取得できる', () => {
    const content = `# Simple Doc
Content without frontmatter`;
    expect(parseFirstHeading(content)).toBe('Simple Doc');
  });

  test('headingがない場合は空文字を返す', () => {
    const content = `---
name: test
---
No heading here`;
    expect(parseFirstHeading(content)).toBe('');
  });

  test('##以上のheadingは無視して#のみ取得する', () => {
    const content = `## Sub heading
### Another heading
# First H1`;
    expect(parseFirstHeading(content)).toBe('First H1');
  });

  test('frontmatter内の#行は無視する', () => {
    const content = `---
comment: "# not a heading"
---
# Real Heading`;
    expect(parseFirstHeading(content)).toBe('Real Heading');
  });

  test('空のコンテンツは空文字を返す', () => {
    expect(parseFirstHeading('')).toBe('');
  });
});
