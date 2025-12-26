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
import type { MdSearchEntry } from '../types';
import { SUGGESTIONS } from '../constants';

/**
 * mdSearch設定が未定義の場合のデフォルト設定を返す
 * 既存の commands.directories と agents.directories 設定と互換性のある動作を提供
 */
/** デフォルトの検索候補最大表示数 - 互換性のため再エクスポート */
export const DEFAULT_MAX_SUGGESTIONS = SUGGESTIONS.DEFAULT_MAX;

/** デフォルトのソート順 */
export const DEFAULT_SORT_ORDER: 'asc' | 'desc' = stryMutAct_9fa48("1111") ? "" : (stryCov_9fa48("1111"), 'asc');
export function getDefaultMdSearchConfig(): MdSearchEntry[] {
  if (stryMutAct_9fa48("1112")) {
    {}
  } else {
    stryCov_9fa48("1112");
    return stryMutAct_9fa48("1113") ? [] : (stryCov_9fa48("1113"), [stryMutAct_9fa48("1114") ? {} : (stryCov_9fa48("1114"), {
      name: stryMutAct_9fa48("1115") ? "" : (stryCov_9fa48("1115"), '{basename}'),
      type: stryMutAct_9fa48("1116") ? "" : (stryCov_9fa48("1116"), 'command'),
      description: stryMutAct_9fa48("1117") ? "" : (stryCov_9fa48("1117"), '{frontmatter@description}'),
      path: stryMutAct_9fa48("1118") ? "" : (stryCov_9fa48("1118"), '~/.claude/commands'),
      pattern: stryMutAct_9fa48("1119") ? "" : (stryCov_9fa48("1119"), '*.md'),
      argumentHint: stryMutAct_9fa48("1120") ? "" : (stryCov_9fa48("1120"), '{frontmatter@argument-hint}'),
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      sortOrder: DEFAULT_SORT_ORDER
    }), stryMutAct_9fa48("1121") ? {} : (stryCov_9fa48("1121"), {
      name: stryMutAct_9fa48("1122") ? "" : (stryCov_9fa48("1122"), 'agent-{basename}'),
      type: stryMutAct_9fa48("1123") ? "" : (stryCov_9fa48("1123"), 'mention'),
      description: stryMutAct_9fa48("1124") ? "" : (stryCov_9fa48("1124"), '{frontmatter@description}'),
      path: stryMutAct_9fa48("1125") ? "" : (stryCov_9fa48("1125"), '~/.claude/agents'),
      pattern: stryMutAct_9fa48("1126") ? "" : (stryCov_9fa48("1126"), '*.md'),
      maxSuggestions: DEFAULT_MAX_SUGGESTIONS,
      sortOrder: DEFAULT_SORT_ORDER
      // searchPrefix: 'agent:', // Uncomment to require @agent: prefix for agent search
    })]);
  }
}