/**
 * TemplateResolver - テンプレート変数を解決するユーティリティ
 *
 * サポートする変数:
 * - {basename}: ファイル名（拡張子なし）
 * - {frontmatter@fieldName}: frontmatterの任意フィールド
 */
// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
export interface TemplateContext {
  basename: string;
  frontmatter: Record<string, string>;
}

/**
 * テンプレート変数を解決する
 * @example
 * resolve("{basename}", { basename: "my-command", frontmatter: {} })
 * // => "my-command"
 *
 * resolve("agent-{frontmatter@name}", { basename: "agent", frontmatter: { name: "helper" } })
 * // => "agent-helper"
 */
export function resolveTemplate(template: string, context: TemplateContext): string {
  if (stryMutAct_9fa48("1127")) {
    {}
  } else {
    stryCov_9fa48("1127");
    let result = template;

    // Replace {basename}
    result = result.replace(/\{basename\}/g, context.basename);

    // Replace {frontmatter@fieldName}
    result = result.replace(stryMutAct_9fa48("1129") ? /\{frontmatter@([}]+)\}/g : stryMutAct_9fa48("1128") ? /\{frontmatter@([^}])\}/g : (stryCov_9fa48("1128", "1129"), /\{frontmatter@([^}]+)\}/g), (_, fieldName: string) => {
      if (stryMutAct_9fa48("1130")) {
        {}
      } else {
        stryCov_9fa48("1130");
        return stryMutAct_9fa48("1131") ? context.frontmatter[fieldName] && '' : (stryCov_9fa48("1131"), context.frontmatter[fieldName] ?? (stryMutAct_9fa48("1132") ? "Stryker was here!" : (stryCov_9fa48("1132"), '')));
      }
    });
    return result;
  }
}

/**
 * ファイルのbasenameを取得（拡張子を除く）
 */
export function getBasename(filePath: string): string {
  if (stryMutAct_9fa48("1133")) {
    {}
  } else {
    stryCov_9fa48("1133");
    const fileName = stryMutAct_9fa48("1134") ? filePath.split('/').pop() && '' : (stryCov_9fa48("1134"), filePath.split(stryMutAct_9fa48("1135") ? "" : (stryCov_9fa48("1135"), '/')).pop() ?? (stryMutAct_9fa48("1136") ? "Stryker was here!" : (stryCov_9fa48("1136"), '')));
    return fileName.replace(stryMutAct_9fa48("1139") ? /\.[.]+$/ : stryMutAct_9fa48("1138") ? /\.[^.]$/ : stryMutAct_9fa48("1137") ? /\.[^.]+/ : (stryCov_9fa48("1137", "1138", "1139"), /\.[^.]+$/), stryMutAct_9fa48("1140") ? "Stryker was here!" : (stryCov_9fa48("1140"), ''));
  }
}

/**
 * Markdownファイルの内容からfrontmatterを解析
 * @returns frontmatterのkey-valueペア
 */
export function parseFrontmatter(content: string): Record<string, string> {
  if (stryMutAct_9fa48("1141")) {
    {}
  } else {
    stryCov_9fa48("1141");
    const frontmatterMatch = content.match(stryMutAct_9fa48("1148") ? /^---\s*\n([\s\s]*?)\n---/ : stryMutAct_9fa48("1147") ? /^---\s*\n([\S\S]*?)\n---/ : stryMutAct_9fa48("1146") ? /^---\s*\n([^\s\S]*?)\n---/ : stryMutAct_9fa48("1145") ? /^---\s*\n([\s\S])\n---/ : stryMutAct_9fa48("1144") ? /^---\S*\n([\s\S]*?)\n---/ : stryMutAct_9fa48("1143") ? /^---\s\n([\s\S]*?)\n---/ : stryMutAct_9fa48("1142") ? /---\s*\n([\s\S]*?)\n---/ : (stryCov_9fa48("1142", "1143", "1144", "1145", "1146", "1147", "1148"), /^---\s*\n([\s\S]*?)\n---/));
    if (stryMutAct_9fa48("1151") ? false : stryMutAct_9fa48("1150") ? true : stryMutAct_9fa48("1149") ? frontmatterMatch?.[1] : (stryCov_9fa48("1149", "1150", "1151"), !(stryMutAct_9fa48("1152") ? frontmatterMatch[1] : (stryCov_9fa48("1152"), frontmatterMatch?.[1])))) {
      if (stryMutAct_9fa48("1153")) {
        {}
      } else {
        stryCov_9fa48("1153");
        return {};
      }
    }
    const frontmatter = frontmatterMatch[1];
    const result: Record<string, string> = {};

    // 各行を解析
    const lines = frontmatter.split(stryMutAct_9fa48("1154") ? "" : (stryCov_9fa48("1154"), '\n'));
    for (const line of lines) {
      if (stryMutAct_9fa48("1155")) {
        {}
      } else {
        stryCov_9fa48("1155");
        const match = line.match(stryMutAct_9fa48("1162") ? /^([a-zA-Z0-9_-]+):\s*(.)$/ : stryMutAct_9fa48("1161") ? /^([a-zA-Z0-9_-]+):\S*(.+)$/ : stryMutAct_9fa48("1160") ? /^([a-zA-Z0-9_-]+):\s(.+)$/ : stryMutAct_9fa48("1159") ? /^([^a-zA-Z0-9_-]+):\s*(.+)$/ : stryMutAct_9fa48("1158") ? /^([a-zA-Z0-9_-]):\s*(.+)$/ : stryMutAct_9fa48("1157") ? /^([a-zA-Z0-9_-]+):\s*(.+)/ : stryMutAct_9fa48("1156") ? /([a-zA-Z0-9_-]+):\s*(.+)$/ : (stryCov_9fa48("1156", "1157", "1158", "1159", "1160", "1161", "1162"), /^([a-zA-Z0-9_-]+):\s*(.+)$/));
        if (stryMutAct_9fa48("1165") ? match?.[1] || match[2] : stryMutAct_9fa48("1164") ? false : stryMutAct_9fa48("1163") ? true : (stryCov_9fa48("1163", "1164", "1165"), (stryMutAct_9fa48("1166") ? match[1] : (stryCov_9fa48("1166"), match?.[1])) && match[2])) {
          if (stryMutAct_9fa48("1167")) {
            {}
          } else {
            stryCov_9fa48("1167");
            let value = stryMutAct_9fa48("1168") ? match[2] : (stryCov_9fa48("1168"), match[2].trim());
            // クォートを除去
            if (stryMutAct_9fa48("1171") ? value.startsWith('"') && value.endsWith('"') && value.startsWith("'") && value.endsWith("'") : stryMutAct_9fa48("1170") ? false : stryMutAct_9fa48("1169") ? true : (stryCov_9fa48("1169", "1170", "1171"), (stryMutAct_9fa48("1173") ? value.startsWith('"') || value.endsWith('"') : stryMutAct_9fa48("1172") ? false : (stryCov_9fa48("1172", "1173"), (stryMutAct_9fa48("1174") ? value.endsWith('"') : (stryCov_9fa48("1174"), value.startsWith(stryMutAct_9fa48("1175") ? "" : (stryCov_9fa48("1175"), '"')))) && (stryMutAct_9fa48("1176") ? value.startsWith('"') : (stryCov_9fa48("1176"), value.endsWith(stryMutAct_9fa48("1177") ? "" : (stryCov_9fa48("1177"), '"')))))) || (stryMutAct_9fa48("1179") ? value.startsWith("'") || value.endsWith("'") : stryMutAct_9fa48("1178") ? false : (stryCov_9fa48("1178", "1179"), (stryMutAct_9fa48("1180") ? value.endsWith("'") : (stryCov_9fa48("1180"), value.startsWith(stryMutAct_9fa48("1181") ? "" : (stryCov_9fa48("1181"), "'")))) && (stryMutAct_9fa48("1182") ? value.startsWith("'") : (stryCov_9fa48("1182"), value.endsWith(stryMutAct_9fa48("1183") ? "" : (stryCov_9fa48("1183"), "'")))))))) {
              if (stryMutAct_9fa48("1184")) {
                {}
              } else {
                stryCov_9fa48("1184");
                value = stryMutAct_9fa48("1185") ? value : (stryCov_9fa48("1185"), value.slice(1, stryMutAct_9fa48("1186") ? +1 : (stryCov_9fa48("1186"), -1)));
              }
            }
            result[match[1]] = value;
          }
        }
      }
    }
    return result;
  }
}

/**
 * frontmatterの生テキストを取得
 */
export function extractRawFrontmatter(content: string): string {
  if (stryMutAct_9fa48("1187")) {
    {}
  } else {
    stryCov_9fa48("1187");
    const frontmatterMatch = content.match(stryMutAct_9fa48("1194") ? /^---\s*\n([\s\s]*?)\n---/ : stryMutAct_9fa48("1193") ? /^---\s*\n([\S\S]*?)\n---/ : stryMutAct_9fa48("1192") ? /^---\s*\n([^\s\S]*?)\n---/ : stryMutAct_9fa48("1191") ? /^---\s*\n([\s\S])\n---/ : stryMutAct_9fa48("1190") ? /^---\S*\n([\s\S]*?)\n---/ : stryMutAct_9fa48("1189") ? /^---\s\n([\s\S]*?)\n---/ : stryMutAct_9fa48("1188") ? /---\s*\n([\s\S]*?)\n---/ : (stryCov_9fa48("1188", "1189", "1190", "1191", "1192", "1193", "1194"), /^---\s*\n([\s\S]*?)\n---/));
    return stryMutAct_9fa48("1195") ? frontmatterMatch?.[1]?.trim() && '' : (stryCov_9fa48("1195"), (stryMutAct_9fa48("1198") ? frontmatterMatch[1]?.trim() : stryMutAct_9fa48("1197") ? frontmatterMatch?.[1].trim() : stryMutAct_9fa48("1196") ? frontmatterMatch?.[1] : (stryCov_9fa48("1196", "1197", "1198"), frontmatterMatch?.[1]?.trim())) ?? (stryMutAct_9fa48("1199") ? "Stryker was here!" : (stryCov_9fa48("1199"), '')));
  }
}