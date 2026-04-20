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

  describe('resolveTemplate with json:N (parent JSON reference)', () => {
    test('{json:1@path}で親要素の値を取得できる', () => {
      const template = '{json:1@team_name}';
      const context = {
        basename: 'config',
        frontmatter: {},
        jsonData: { name: 'alice' },
        parentJsonDataStack: [{ team_name: 'alpha', members: [] }]
      };
      expect(resolveTemplate(template, context)).toBe('alpha');
    });

    test('{json:2@path}で2階層上の値を取得できる', () => {
      const template = '{json:2@org}';
      const context = {
        basename: 'config',
        frontmatter: {},
        jsonData: { name: 'alice' },
        parentJsonDataStack: [
          { team_name: 'alpha' },
          { org: 'acme-corp' }
        ]
      };
      expect(resolveTemplate(template, context)).toBe('acme-corp');
    });

    test('階層不足時に空文字を返す', () => {
      const template = '{json:3@field}';
      const context = {
        basename: 'config',
        frontmatter: {},
        jsonData: { name: 'alice' },
        parentJsonDataStack: [{ team_name: 'alpha' }]
      };
      expect(resolveTemplate(template, context)).toBe('');
    });

    test('{json@path}と{json:1@path}を組み合わせて使用できる', () => {
      const template = '{json@name} ({json:1@team_name})';
      const context = {
        basename: 'config',
        frontmatter: {},
        jsonData: { name: 'alice' },
        parentJsonDataStack: [{ team_name: 'alpha' }]
      };
      expect(resolveTemplate(template, context)).toBe('alice (alpha)');
    });

    test('parentJsonDataStackがundefinedの場合は{json:N@path}をそのまま残す', () => {
      const template = '{json:1@field}';
      const context = {
        basename: 'config',
        frontmatter: {},
        jsonData: { name: 'alice' }
      };
      expect(resolveTemplate(template, context)).toBe('{json:1@field}');
    });

    test('{json:0@path}は無効（N=0は範囲外）で空文字を返す', () => {
      const template = '{json:0@field}';
      const context = {
        basename: 'config',
        frontmatter: {},
        jsonData: { name: 'alice' },
        parentJsonDataStack: [{ field: 'value' }]
      };
      expect(resolveTemplate(template, context)).toBe('');
    });

    test('{json:1@nested.path}でネストされた親要素の値を取得できる', () => {
      const template = '{json:1@config.name}';
      const context = {
        basename: 'file',
        frontmatter: {},
        jsonData: { id: 1 },
        parentJsonDataStack: [{ config: { name: 'test-config' } }]
      };
      expect(resolveTemplate(template, context)).toBe('test-config');
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

describe('resolveTemplate fallback syntax (pipe)', () => {
  test('左側が空の場合、右側にフォールバックする', () => {
    const template = '{frontmatter@description}|{heading}';
    const context = {
      basename: 'test',
      frontmatter: {},
      heading: 'My Heading'
    };
    expect(resolveTemplate(template, context)).toBe('My Heading');
  });

  test('左側に値がある場合、左側を使用する', () => {
    const template = '{frontmatter@description}|{heading}';
    const context = {
      basename: 'test',
      frontmatter: { description: 'From frontmatter' },
      heading: 'My Heading'
    };
    expect(resolveTemplate(template, context)).toBe('From frontmatter');
  });

  test('両方空の場合は空文字を返す', () => {
    const template = '{frontmatter@description}|{heading}';
    const context = {
      basename: 'test',
      frontmatter: {},
      heading: ''
    };
    expect(resolveTemplate(template, context)).toBe('');
  });

  test('リテラル文字列をフォールバックに使用できる', () => {
    const template = '{frontmatter@description}|No description';
    const context = {
      basename: 'test',
      frontmatter: {}
    };
    expect(resolveTemplate(template, context)).toBe('No description');
  });

  test('パイプなしのテンプレートは従来通り動作する', () => {
    const template = '{basename}';
    const context = {
      basename: 'test',
      frontmatter: {}
    };
    expect(resolveTemplate(template, context)).toBe('test');
  });
});

describe('valueTransform support', () => {
  const shellQuote = (v: string) => "'" + v.replace(/'/g, "'\\''") + "'";

  test('{dirname:N} の結果に valueTransform が適用される', () => {
    expect(resolveTemplate('{dirname:1}', {
      basename: 'file',
      frontmatter: {},
      filePath: '/a/b/c/file.md',
    }, shellQuote)).toBe("'c'");
  });

  test('{filepath} に valueTransform が適用される', () => {
    expect(resolveTemplate('{filepath}', {
      basename: 'file',
      frontmatter: {},
      filePath: '/a/b/file.md',
    }, shellQuote)).toBe("'/a/b/file.md'");
  });

  test('valueTransform がシェルメタ文字を含むディレクトリ名を安全にクォートする', () => {
    expect(resolveTemplate('{dirname:1}', {
      basename: 'file',
      frontmatter: {},
      filePath: '/a/$(malicious)/file.md',
    }, shellQuote)).toBe("'$(malicious)'");
  });

  test('valueTransform 未設定時は従来通り動作する', () => {
    expect(resolveTemplate('{dirname:1}', {
      basename: 'file',
      frontmatter: {},
      filePath: '/a/b/c/file.md',
    })).toBe('c');
  });

  test('{dirname}（N なし）にも valueTransform が適用される', () => {
    expect(resolveTemplate('{dirname}', {
      basename: 'file',
      frontmatter: {},
      dirname: 'my-dir',
    }, shellQuote)).toBe("'my-dir'");
  });

  test('{basename} に valueTransform が適用される', () => {
    expect(resolveTemplate('{basename}', {
      basename: '$(whoami)',
      frontmatter: {},
    }, shellQuote)).toBe("'$(whoami)'");
  });

  test('{frontmatter@field} に valueTransform が適用される', () => {
    expect(resolveTemplate('{frontmatter@name}', {
      basename: 'file',
      frontmatter: { name: '`evil`' },
    }, shellQuote)).toBe("'`evil`'");
  });

  test('{json@path} の JSON.stringify 結果にも valueTransform が適用される', () => {
    const data = { nested: { '$(whoami)': 'safe' } };
    expect(resolveTemplate('{json@nested}', {
      basename: 'file',
      frontmatter: {},
      jsonData: data,
    }, shellQuote)).toBe("'{\"$(whoami)\":\"safe\"}'");
  });

  test('{content} に valueTransform が適用される', () => {
    expect(resolveTemplate('{content}', {
      basename: 'file',
      frontmatter: {},
      content: '; rm -rf /',
    }, shellQuote)).toBe("'; rm -rf /'");
  });

  test('{projectdir} に valueTransform が適用される', () => {
    expect(resolveTemplate('{projectdir}', {
      basename: 'file',
      frontmatter: {},
      projectdir: '/path/with spaces',
    }, shellQuote)).toBe("'/path/with spaces'");
  });
});

describe('resolveTemplate with projectdir', () => {
  test('{projectdir}を置換できる', () => {
    expect(resolveTemplate('{projectdir}', {
      basename: 'test',
      frontmatter: {},
      projectdir: '/Users/user/project',
    })).toBe('/Users/user/project');
  });

  test('{projectdir}がundefinedの場合はそのまま残る', () => {
    expect(resolveTemplate('{projectdir}', {
      basename: 'test',
      frontmatter: {},
    })).toBe('{projectdir}');
  });

  test('{projectdir}と他の変数を組み合わせて使用できる', () => {
    expect(resolveTemplate('git -C {projectdir} log', {
      basename: 'test',
      frontmatter: {},
      projectdir: '/Users/user/project',
    })).toBe('git -C /Users/user/project log');
  });

  test('{projectdir}が空文字の場合は空に置換される', () => {
    expect(resolveTemplate('{projectdir}', {
      basename: 'test',
      frontmatter: {},
      projectdir: '',
    })).toBe('');
  });
});

describe('resolveTemplate pathological / special inputs', () => {
  describe('special characters in values', () => {
    test('emoji / surrogate pair を壊さずに展開する', () => {
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { display: '🎉 surrogate 𝕳𝖊𝖑𝖑𝖔 👨‍👩‍👧‍👦' },
      };
      expect(resolveTemplate('{json@display}', ctx)).toBe('🎉 surrogate 𝕳𝖊𝖑𝖑𝖔 👨‍👩‍👧‍👦');
    });

    test('ANSI escape / control chars / null byte を保持する', () => {
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { display: '\u001b[31mRED\u001b[0m\tnull\u0000end\r\n' },
      };
      expect(resolveTemplate('{json@display}', ctx)).toBe('\u001b[31mRED\u001b[0m\tnull\u0000end\r\n');
    });

    test('RTL・合字・正規化違い（NFC/NFD）を壊さない', () => {
      const composed = 'café';               // NFC
      const decomposed = 'cafe\u0301';       // NFD
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { a: composed, b: decomposed, rtl: 'שלום עולם' },
      };
      expect(resolveTemplate('{json@a}', ctx)).toBe(composed);
      expect(resolveTemplate('{json@b}', ctx)).toBe(decomposed);
      expect(resolveTemplate('{json@rtl}', ctx)).toBe('שלום עולם');
    });

    test('値側に含まれる {json@...} ライクな文字列は再解釈しない', () => {
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { display: 'literal {json@foo} and {basename}' },
      };
      expect(resolveTemplate('{json@display}', ctx))
        .toBe('literal {json@foo} and {basename}');
    });

    test('正規表現メタ文字を含むキー／値を正しく扱う', () => {
      // Note: トークン内に `|` `{` `}` を含むキーはテンプレート構文と衝突するため非対応
      const ctx = {
        basename: 'x',
        frontmatter: { 'a.b*c': 'matched' },
        values: { '.*+?^()[].\\': 'escaped-value' },
      };
      expect(resolveTemplate('{frontmatter@a.b*c}', ctx)).toBe('matched');
      expect(resolveTemplate('{.*+?^()[].\\}', ctx)).toBe('escaped-value');
    });
  });

  describe('large data', () => {
    test('1MB の文字列を content として展開してもクラッシュしない', () => {
      const huge = 'x'.repeat(1024 * 1024);
      const ctx = { basename: 'x', frontmatter: {}, jsonData: { display: huge } };
      const out = resolveTemplate('{json@display}', ctx);
      expect(out).toHaveLength(huge.length);
      expect(out[0]).toBe('x');
    });

    test('オブジェクト値は JSON.stringify で返される（歴史的挙動の維持）', () => {
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { items: [1, 2, { nested: true }] },
      };
      expect(resolveTemplate('{json@items}', ctx)).toBe('[1,2,{"nested":true}]');
    });

    test('50 段のネストを辿れる', () => {
      let deep: Record<string, unknown> = { leaf: 'found' };
      for (let i = 50; i > 0; i--) deep = { [`l${i}`]: deep };
      const path = Array.from({ length: 50 }, (_, i) => `l${i + 1}`).join('.') + '.leaf';
      const ctx = { basename: 'x', frontmatter: {}, jsonData: deep };
      expect(resolveTemplate(`{json@${path}}`, ctx)).toBe('found');
    });

    test('50 段の pipe フォールバック後に最後の非空セグメントを返す', () => {
      const segs = Array.from({ length: 50 }, (_, i) => `{json@missing${i}}`);
      const tmpl = segs.join('|') + '|found';
      const ctx = { basename: 'x', frontmatter: {}, jsonData: {} };
      expect(resolveTemplate(tmpl, ctx)).toBe('found');
    });
  });

  describe('unexpected data shapes', () => {
    test('jsonData が null/undefined ならリテラルを残す', () => {
      const ctx = { basename: 'x', frontmatter: {} };
      expect(resolveTemplate('{json@foo}', ctx)).toBe('{json@foo}');
    });

    test('パス途中が配列・プリミティブでも安全に空を返す', () => {
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { arr: [1, 2, 3], prim: 'string', obj: { x: null } },
      };
      // 配列にキーアクセス→空
      expect(resolveTemplate('{json@arr.foo}', ctx)).toBe('');
      // プリミティブにキーアクセス→空
      expect(resolveTemplate('{json@prim.foo}', ctx)).toBe('');
      // null 値→空
      expect(resolveTemplate('{json@obj.x}', ctx)).toBe('');
      // 配列の負インデックス
      expect(resolveTemplate('{json@arr[-1]}', ctx)).toBe('3');
      // 範囲外
      expect(resolveTemplate('{json@arr[99]}', ctx)).toBe('');
      // 存在しないキー
      expect(resolveTemplate('{json@missing.key.path}', ctx)).toBe('');
    });

    test('値が 0/false/空文字のとき pipe フォールバックは発動する', () => {
      const ctx = {
        basename: 'x',
        frontmatter: {},
        jsonData: { a: '', b: 0, c: false, d: 'hit' },
      };
      // '' はフォールバック対象
      expect(resolveTemplate('{json@a}|{json@d}', ctx)).toBe('hit');
      // 0 は "0" になるのでフォールバックしない (非空文字列)
      expect(resolveTemplate('{json@b}|{json@d}', ctx)).toBe('0');
      // false は "false" になる
      expect(resolveTemplate('{json@c}|{json@d}', ctx)).toBe('false');
    });

    test('ブレース内に @ や : を含む不正トークンはリテラルのまま残る', () => {
      const ctx = { basename: 'x', frontmatter: {}, jsonData: { a: 1 } };
      expect(resolveTemplate('{json@}', ctx)).toBe('{json@}');
      expect(resolveTemplate('{frontmatter@}', ctx)).toBe('{frontmatter@}');
      expect(resolveTemplate('{json:abc@x}', ctx)).toBe('{json:abc@x}');
    });
  });

  describe('cache robustness', () => {
    test('同じテンプレートを 10,000 回呼んでも結果が一貫する', () => {
      const tmpl = '{json@a}|{json@b}|{json@c}';
      const ctx = { basename: 'x', frontmatter: {}, jsonData: { a: '', b: '', c: 'ok' } };
      for (let i = 0; i < 10_000; i++) {
        expect(resolveTemplate(tmpl, ctx)).toBe('ok');
      }
    });

    test('cache 上限（500 超）を超える相異なテンプレートでも正しく解決する', () => {
      const ctx = { basename: 'x', frontmatter: {}, jsonData: { v: 'ok' } };
      for (let i = 0; i < 700; i++) {
        expect(resolveTemplate(`#${i}:{json@v}`, ctx)).toBe(`#${i}:ok`);
      }
      // 直後に古いテンプレートを呼んでも、再解決で同じ結果になる
      expect(resolveTemplate('#0:{json@v}', ctx)).toBe('#0:ok');
    });

    test('values 優先（json/frontmatter/args より先）を保つ', () => {
      const ctx = {
        basename: 'x',
        frontmatter: { name: 'fm' },
        values: { 'frontmatter@name': 'values-wins' },
      };
      expect(resolveTemplate('{frontmatter@name}', ctx)).toBe('values-wins');
    });
  });
});
