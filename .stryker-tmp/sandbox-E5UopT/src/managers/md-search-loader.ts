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
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import type { MdSearchEntry, MdSearchItem, MdSearchType } from '../types';
import { resolveTemplate, getBasename, parseFrontmatter, extractRawFrontmatter } from '../lib/template-resolver';
import { getDefaultMdSearchConfig, DEFAULT_MAX_SUGGESTIONS, DEFAULT_SORT_ORDER } from '../lib/default-md-search-config';

/**
 * MdSearchLoader - 設定ベースの統合Markdownファイルローダー
 *
 * SlashCommandLoaderとAgentLoaderを統合し、より柔軟な設定が可能
 */
class MdSearchLoader {
  private config: MdSearchEntry[];
  private cache: Map<string, {
    items: MdSearchItem[];
    timestamp: number;
  }> = new Map();
  private cacheTTL: number = 5000; // 5 seconds

  constructor(config?: MdSearchEntry[]) {
    if (stryMutAct_9fa48("2864")) {
      {}
    } else {
      stryCov_9fa48("2864");
      // Use default config if config is undefined or empty array
      this.config = (stryMutAct_9fa48("2867") ? config || config.length > 0 : stryMutAct_9fa48("2866") ? false : stryMutAct_9fa48("2865") ? true : (stryCov_9fa48("2865", "2866", "2867"), config && (stryMutAct_9fa48("2870") ? config.length <= 0 : stryMutAct_9fa48("2869") ? config.length >= 0 : stryMutAct_9fa48("2868") ? true : (stryCov_9fa48("2868", "2869", "2870"), config.length > 0)))) ? config : getDefaultMdSearchConfig();
    }
  }

  /**
   * 設定を更新（設定変更時に呼び出す）
   */
  updateConfig(config: MdSearchEntry[] | undefined): void {
    if (stryMutAct_9fa48("2871")) {
      {}
    } else {
      stryCov_9fa48("2871");
      // Use default config if config is undefined or empty array
      const newConfig = (stryMutAct_9fa48("2874") ? config || config.length > 0 : stryMutAct_9fa48("2873") ? false : stryMutAct_9fa48("2872") ? true : (stryCov_9fa48("2872", "2873", "2874"), config && (stryMutAct_9fa48("2877") ? config.length <= 0 : stryMutAct_9fa48("2876") ? config.length >= 0 : stryMutAct_9fa48("2875") ? true : (stryCov_9fa48("2875", "2876", "2877"), config.length > 0)))) ? config : getDefaultMdSearchConfig();

      // 設定が変わった場合のみキャッシュをクリア
      if (stryMutAct_9fa48("2880") ? JSON.stringify(this.config) === JSON.stringify(newConfig) : stryMutAct_9fa48("2879") ? false : stryMutAct_9fa48("2878") ? true : (stryCov_9fa48("2878", "2879", "2880"), JSON.stringify(this.config) !== JSON.stringify(newConfig))) {
        if (stryMutAct_9fa48("2881")) {
          {}
        } else {
          stryCov_9fa48("2881");
          this.config = newConfig;
          this.invalidateCache();
          logger.debug(stryMutAct_9fa48("2882") ? "" : (stryCov_9fa48("2882"), 'MdSearchLoader config updated'), stryMutAct_9fa48("2883") ? {} : (stryCov_9fa48("2883"), {
            entryCount: this.config.length
          }));
        }
      }
    }
  }

  /**
   * キャッシュを無効化
   */
  invalidateCache(): void {
    if (stryMutAct_9fa48("2884")) {
      {}
    } else {
      stryCov_9fa48("2884");
      this.cache.clear();
      logger.debug(stryMutAct_9fa48("2885") ? "" : (stryCov_9fa48("2885"), 'MdSearchLoader cache invalidated'));
    }
  }

  /**
   * 指定タイプのアイテムを取得
   */
  async getItems(type: MdSearchType): Promise<MdSearchItem[]> {
    if (stryMutAct_9fa48("2886")) {
      {}
    } else {
      stryCov_9fa48("2886");
      const allItems = await this.loadAll();
      const items = stryMutAct_9fa48("2887") ? allItems : (stryCov_9fa48("2887"), allItems.filter(stryMutAct_9fa48("2888") ? () => undefined : (stryCov_9fa48("2888"), item => stryMutAct_9fa48("2891") ? item.type !== type : stryMutAct_9fa48("2890") ? false : stryMutAct_9fa48("2889") ? true : (stryCov_9fa48("2889", "2890", "2891"), item.type === type))));
      const sortOrder = this.getSortOrder(type);
      return this.sortItems(items, sortOrder);
    }
  }

  /**
   * 指定タイプのアイテムを検索
   * searchPrefixが設定されているエントリは、クエリがそのプレフィックスで始まる場合のみ検索対象
   */
  async searchItems(type: MdSearchType, query: string): Promise<MdSearchItem[]> {
    if (stryMutAct_9fa48("2892")) {
      {}
    } else {
      stryCov_9fa48("2892");
      const allItems = await this.loadAll();

      // タイプでフィルタリング
      let items = stryMutAct_9fa48("2893") ? allItems : (stryCov_9fa48("2893"), allItems.filter(stryMutAct_9fa48("2894") ? () => undefined : (stryCov_9fa48("2894"), item => stryMutAct_9fa48("2897") ? item.type !== type : stryMutAct_9fa48("2896") ? false : stryMutAct_9fa48("2895") ? true : (stryCov_9fa48("2895", "2896", "2897"), item.type === type))));

      // searchPrefixが設定されているエントリをフィルタリング
      items = stryMutAct_9fa48("2898") ? items : (stryCov_9fa48("2898"), items.filter(item => {
        if (stryMutAct_9fa48("2899")) {
          {}
        } else {
          stryCov_9fa48("2899");
          const entry = this.findEntryForItem(item);
          if (stryMutAct_9fa48("2902") ? false : stryMutAct_9fa48("2901") ? true : stryMutAct_9fa48("2900") ? entry?.searchPrefix : (stryCov_9fa48("2900", "2901", "2902"), !(stryMutAct_9fa48("2903") ? entry.searchPrefix : (stryCov_9fa48("2903"), entry?.searchPrefix)))) {
            if (stryMutAct_9fa48("2904")) {
              {}
            } else {
              stryCov_9fa48("2904");
              // searchPrefixが未設定の場合は常に検索対象
              return stryMutAct_9fa48("2905") ? false : (stryCov_9fa48("2905"), true);
            }
          }
          // queryがsearchPrefixで始まるかチェック
          return stryMutAct_9fa48("2906") ? query.endsWith(entry.searchPrefix) : (stryCov_9fa48("2906"), query.startsWith(entry.searchPrefix));
        }
      }));

      // クエリに基づいてソート順を決定
      const sortOrder = this.getSortOrderForQuery(type, query);
      if (stryMutAct_9fa48("2909") ? false : stryMutAct_9fa48("2908") ? true : stryMutAct_9fa48("2907") ? query : (stryCov_9fa48("2907", "2908", "2909"), !query)) {
        if (stryMutAct_9fa48("2910")) {
          {}
        } else {
          stryCov_9fa48("2910");
          return this.sortItems(items, sortOrder);
        }
      }

      // 各アイテムの実際の検索クエリを計算（searchPrefixを除去）
      const filteredItems = stryMutAct_9fa48("2911") ? items : (stryCov_9fa48("2911"), items.filter(item => {
        if (stryMutAct_9fa48("2912")) {
          {}
        } else {
          stryCov_9fa48("2912");
          const entry = this.findEntryForItem(item);
          const prefix = stryMutAct_9fa48("2915") ? entry?.searchPrefix && '' : stryMutAct_9fa48("2914") ? false : stryMutAct_9fa48("2913") ? true : (stryCov_9fa48("2913", "2914", "2915"), (stryMutAct_9fa48("2916") ? entry.searchPrefix : (stryCov_9fa48("2916"), entry?.searchPrefix)) || (stryMutAct_9fa48("2917") ? "Stryker was here!" : (stryCov_9fa48("2917"), '')));
          const actualQuery = (stryMutAct_9fa48("2918") ? query.endsWith(prefix) : (stryCov_9fa48("2918"), query.startsWith(prefix))) ? stryMutAct_9fa48("2919") ? query : (stryCov_9fa48("2919"), query.slice(prefix.length)) : query;

          // プレフィックスのみの場合は全て表示
          if (stryMutAct_9fa48("2922") ? false : stryMutAct_9fa48("2921") ? true : stryMutAct_9fa48("2920") ? actualQuery : (stryCov_9fa48("2920", "2921", "2922"), !actualQuery)) {
            if (stryMutAct_9fa48("2923")) {
              {}
            } else {
              stryCov_9fa48("2923");
              return stryMutAct_9fa48("2924") ? false : (stryCov_9fa48("2924"), true);
            }
          }
          const lowerActualQuery = stryMutAct_9fa48("2925") ? actualQuery.toUpperCase() : (stryCov_9fa48("2925"), actualQuery.toLowerCase());
          return stryMutAct_9fa48("2928") ? item.name.toLowerCase().includes(lowerActualQuery) && item.description.toLowerCase().includes(lowerActualQuery) : stryMutAct_9fa48("2927") ? false : stryMutAct_9fa48("2926") ? true : (stryCov_9fa48("2926", "2927", "2928"), (stryMutAct_9fa48("2929") ? item.name.toUpperCase().includes(lowerActualQuery) : (stryCov_9fa48("2929"), item.name.toLowerCase().includes(lowerActualQuery))) || (stryMutAct_9fa48("2930") ? item.description.toUpperCase().includes(lowerActualQuery) : (stryCov_9fa48("2930"), item.description.toLowerCase().includes(lowerActualQuery))));
        }
      }));
      return this.sortItems(filteredItems, sortOrder);
    }
  }

  /**
   * アイテムに対応する設定エントリを検索
   */
  private findEntryForItem(item: MdSearchItem): MdSearchEntry | undefined {
    if (stryMutAct_9fa48("2931")) {
      {}
    } else {
      stryCov_9fa48("2931");
      return this.config.find(stryMutAct_9fa48("2932") ? () => undefined : (stryCov_9fa48("2932"), entry => stryMutAct_9fa48("2935") ? entry.type === item.type || `${entry.path}:${entry.pattern}` === item.sourceId : stryMutAct_9fa48("2934") ? false : stryMutAct_9fa48("2933") ? true : (stryCov_9fa48("2933", "2934", "2935"), (stryMutAct_9fa48("2937") ? entry.type !== item.type : stryMutAct_9fa48("2936") ? true : (stryCov_9fa48("2936", "2937"), entry.type === item.type)) && (stryMutAct_9fa48("2939") ? `${entry.path}:${entry.pattern}` !== item.sourceId : stryMutAct_9fa48("2938") ? true : (stryCov_9fa48("2938", "2939"), (stryMutAct_9fa48("2940") ? `` : (stryCov_9fa48("2940"), `${entry.path}:${entry.pattern}`)) === item.sourceId)))));
    }
  }

  /**
   * 指定タイプのmaxSuggestionsを取得（複数エントリがある場合は最大値を返す）
   */
  getMaxSuggestions(type: MdSearchType): number {
    if (stryMutAct_9fa48("2941")) {
      {}
    } else {
      stryCov_9fa48("2941");
      const entries = stryMutAct_9fa48("2942") ? this.config : (stryCov_9fa48("2942"), this.config.filter(stryMutAct_9fa48("2943") ? () => undefined : (stryCov_9fa48("2943"), entry => stryMutAct_9fa48("2946") ? entry.type !== type : stryMutAct_9fa48("2945") ? false : stryMutAct_9fa48("2944") ? true : (stryCov_9fa48("2944", "2945", "2946"), entry.type === type))));
      if (stryMutAct_9fa48("2949") ? entries.length !== 0 : stryMutAct_9fa48("2948") ? false : stryMutAct_9fa48("2947") ? true : (stryCov_9fa48("2947", "2948", "2949"), entries.length === 0)) {
        if (stryMutAct_9fa48("2950")) {
          {}
        } else {
          stryCov_9fa48("2950");
          return DEFAULT_MAX_SUGGESTIONS;
        }
      }
      // 複数エントリがある場合は最大値を使用
      return stryMutAct_9fa48("2951") ? Math.min(...entries.map(entry => entry.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS)) : (stryCov_9fa48("2951"), Math.max(...entries.map(stryMutAct_9fa48("2952") ? () => undefined : (stryCov_9fa48("2952"), entry => stryMutAct_9fa48("2953") ? entry.maxSuggestions && DEFAULT_MAX_SUGGESTIONS : (stryCov_9fa48("2953"), entry.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS)))));
    }
  }

  /**
   * 指定タイプのsearchPrefixリストを取得
   */
  getSearchPrefixes(type: MdSearchType): string[] {
    if (stryMutAct_9fa48("2954")) {
      {}
    } else {
      stryCov_9fa48("2954");
      const entries = stryMutAct_9fa48("2955") ? this.config : (stryCov_9fa48("2955"), this.config.filter(stryMutAct_9fa48("2956") ? () => undefined : (stryCov_9fa48("2956"), entry => stryMutAct_9fa48("2959") ? entry.type === type || entry.searchPrefix : stryMutAct_9fa48("2958") ? false : stryMutAct_9fa48("2957") ? true : (stryCov_9fa48("2957", "2958", "2959"), (stryMutAct_9fa48("2961") ? entry.type !== type : stryMutAct_9fa48("2960") ? true : (stryCov_9fa48("2960", "2961"), entry.type === type)) && entry.searchPrefix))));
      return entries.map(stryMutAct_9fa48("2962") ? () => undefined : (stryCov_9fa48("2962"), entry => entry.searchPrefix!));
    }
  }

  /**
   * 指定タイプのsortOrderを取得（複数エントリがある場合は最初のエントリの設定を返す）
   */
  getSortOrder(type: MdSearchType): 'asc' | 'desc' {
    if (stryMutAct_9fa48("2963")) {
      {}
    } else {
      stryCov_9fa48("2963");
      const entries = stryMutAct_9fa48("2964") ? this.config : (stryCov_9fa48("2964"), this.config.filter(stryMutAct_9fa48("2965") ? () => undefined : (stryCov_9fa48("2965"), entry => stryMutAct_9fa48("2968") ? entry.type !== type : stryMutAct_9fa48("2967") ? false : stryMutAct_9fa48("2966") ? true : (stryCov_9fa48("2966", "2967", "2968"), entry.type === type))));
      if (stryMutAct_9fa48("2971") ? entries.length !== 0 : stryMutAct_9fa48("2970") ? false : stryMutAct_9fa48("2969") ? true : (stryCov_9fa48("2969", "2970", "2971"), entries.length === 0)) {
        if (stryMutAct_9fa48("2972")) {
          {}
        } else {
          stryCov_9fa48("2972");
          return DEFAULT_SORT_ORDER;
        }
      }
      // 最初のエントリの設定を使用（未設定の場合はデフォルト）
      return stryMutAct_9fa48("2973") ? entries[0]?.sortOrder && DEFAULT_SORT_ORDER : (stryCov_9fa48("2973"), (stryMutAct_9fa48("2974") ? entries[0].sortOrder : (stryCov_9fa48("2974"), entries[0]?.sortOrder)) ?? DEFAULT_SORT_ORDER);
    }
  }

  /**
   * クエリのsearchPrefixにマッチするエントリのsortOrderを取得
   */
  getSortOrderForQuery(type: MdSearchType, query: string): 'asc' | 'desc' {
    if (stryMutAct_9fa48("2975")) {
      {}
    } else {
      stryCov_9fa48("2975");
      const entries = stryMutAct_9fa48("2976") ? this.config : (stryCov_9fa48("2976"), this.config.filter(stryMutAct_9fa48("2977") ? () => undefined : (stryCov_9fa48("2977"), entry => stryMutAct_9fa48("2980") ? entry.type !== type : stryMutAct_9fa48("2979") ? false : stryMutAct_9fa48("2978") ? true : (stryCov_9fa48("2978", "2979", "2980"), entry.type === type))));
      if (stryMutAct_9fa48("2983") ? entries.length !== 0 : stryMutAct_9fa48("2982") ? false : stryMutAct_9fa48("2981") ? true : (stryCov_9fa48("2981", "2982", "2983"), entries.length === 0)) {
        if (stryMutAct_9fa48("2984")) {
          {}
        } else {
          stryCov_9fa48("2984");
          return DEFAULT_SORT_ORDER;
        }
      }

      // クエリがsearchPrefixで始まるエントリを探す
      const matchingEntry = entries.find(stryMutAct_9fa48("2985") ? () => undefined : (stryCov_9fa48("2985"), entry => stryMutAct_9fa48("2988") ? entry.searchPrefix || query.startsWith(entry.searchPrefix) : stryMutAct_9fa48("2987") ? false : stryMutAct_9fa48("2986") ? true : (stryCov_9fa48("2986", "2987", "2988"), entry.searchPrefix && (stryMutAct_9fa48("2989") ? query.endsWith(entry.searchPrefix) : (stryCov_9fa48("2989"), query.startsWith(entry.searchPrefix))))));
      if (stryMutAct_9fa48("2991") ? false : stryMutAct_9fa48("2990") ? true : (stryCov_9fa48("2990", "2991"), matchingEntry)) {
        if (stryMutAct_9fa48("2992")) {
          {}
        } else {
          stryCov_9fa48("2992");
          return stryMutAct_9fa48("2993") ? matchingEntry.sortOrder && DEFAULT_SORT_ORDER : (stryCov_9fa48("2993"), matchingEntry.sortOrder ?? DEFAULT_SORT_ORDER);
        }
      }

      // searchPrefixがマッチしない場合は、searchPrefixが未設定のエントリを探す
      const defaultEntry = entries.find(stryMutAct_9fa48("2994") ? () => undefined : (stryCov_9fa48("2994"), entry => stryMutAct_9fa48("2995") ? entry.searchPrefix : (stryCov_9fa48("2995"), !entry.searchPrefix)));
      if (stryMutAct_9fa48("2997") ? false : stryMutAct_9fa48("2996") ? true : (stryCov_9fa48("2996", "2997"), defaultEntry)) {
        if (stryMutAct_9fa48("2998")) {
          {}
        } else {
          stryCov_9fa48("2998");
          return stryMutAct_9fa48("2999") ? defaultEntry.sortOrder && DEFAULT_SORT_ORDER : (stryCov_9fa48("2999"), defaultEntry.sortOrder ?? DEFAULT_SORT_ORDER);
        }
      }

      // フォールバック: 最初のエントリの設定を使用
      return stryMutAct_9fa48("3000") ? entries[0]?.sortOrder && DEFAULT_SORT_ORDER : (stryCov_9fa48("3000"), (stryMutAct_9fa48("3001") ? entries[0].sortOrder : (stryCov_9fa48("3001"), entries[0]?.sortOrder)) ?? DEFAULT_SORT_ORDER);
    }
  }

  /**
   * アイテムを指定のソート順でソート
   */
  private sortItems(items: MdSearchItem[], sortOrder: 'asc' | 'desc'): MdSearchItem[] {
    if (stryMutAct_9fa48("3002")) {
      {}
    } else {
      stryCov_9fa48("3002");
      return stryMutAct_9fa48("3003") ? [...items] : (stryCov_9fa48("3003"), (stryMutAct_9fa48("3004") ? [] : (stryCov_9fa48("3004"), [...items])).sort((a, b) => {
        if (stryMutAct_9fa48("3005")) {
          {}
        } else {
          stryCov_9fa48("3005");
          const comparison = a.name.localeCompare(b.name);
          return (stryMutAct_9fa48("3008") ? sortOrder !== 'desc' : stryMutAct_9fa48("3007") ? false : stryMutAct_9fa48("3006") ? true : (stryCov_9fa48("3006", "3007", "3008"), sortOrder === (stryMutAct_9fa48("3009") ? "" : (stryCov_9fa48("3009"), 'desc')))) ? stryMutAct_9fa48("3010") ? +comparison : (stryCov_9fa48("3010"), -comparison) : comparison;
        }
      }));
    }
  }

  /**
   * 全設定エントリからアイテムをロード
   */
  private async loadAll(): Promise<MdSearchItem[]> {
    if (stryMutAct_9fa48("3011")) {
      {}
    } else {
      stryCov_9fa48("3011");
      // キャッシュチェック
      const cacheKey = stryMutAct_9fa48("3012") ? "" : (stryCov_9fa48("3012"), 'all');
      const cached = this.cache.get(cacheKey);
      if (stryMutAct_9fa48("3015") ? cached || Date.now() - cached.timestamp < this.cacheTTL : stryMutAct_9fa48("3014") ? false : stryMutAct_9fa48("3013") ? true : (stryCov_9fa48("3013", "3014", "3015"), cached && (stryMutAct_9fa48("3018") ? Date.now() - cached.timestamp >= this.cacheTTL : stryMutAct_9fa48("3017") ? Date.now() - cached.timestamp <= this.cacheTTL : stryMutAct_9fa48("3016") ? true : (stryCov_9fa48("3016", "3017", "3018"), (stryMutAct_9fa48("3019") ? Date.now() + cached.timestamp : (stryCov_9fa48("3019"), Date.now() - cached.timestamp)) < this.cacheTTL)))) {
        if (stryMutAct_9fa48("3020")) {
          {}
        } else {
          stryCov_9fa48("3020");
          return cached.items;
        }
      }
      const allItems: MdSearchItem[] = stryMutAct_9fa48("3021") ? ["Stryker was here"] : (stryCov_9fa48("3021"), []);
      const seenNames = new Map<MdSearchType, Set<string>>();
      for (const entry of this.config) {
        if (stryMutAct_9fa48("3022")) {
          {}
        } else {
          stryCov_9fa48("3022");
          try {
            if (stryMutAct_9fa48("3023")) {
              {}
            } else {
              stryCov_9fa48("3023");
              const items = await this.loadEntry(entry);

              // タイプごとの重複チェック用Setを取得または作成
              if (stryMutAct_9fa48("3026") ? false : stryMutAct_9fa48("3025") ? true : stryMutAct_9fa48("3024") ? seenNames.has(entry.type) : (stryCov_9fa48("3024", "3025", "3026"), !seenNames.has(entry.type))) {
                if (stryMutAct_9fa48("3027")) {
                  {}
                } else {
                  stryCov_9fa48("3027");
                  seenNames.set(entry.type, new Set());
                }
              }
              const typeSeenNames = seenNames.get(entry.type)!;
              for (const item of items) {
                if (stryMutAct_9fa48("3028")) {
                  {}
                } else {
                  stryCov_9fa48("3028");
                  // 同じタイプ内での重複を防ぐ
                  if (stryMutAct_9fa48("3031") ? false : stryMutAct_9fa48("3030") ? true : stryMutAct_9fa48("3029") ? typeSeenNames.has(item.name) : (stryCov_9fa48("3029", "3030", "3031"), !typeSeenNames.has(item.name))) {
                    if (stryMutAct_9fa48("3032")) {
                      {}
                    } else {
                      stryCov_9fa48("3032");
                      typeSeenNames.add(item.name);
                      allItems.push(item);
                    }
                  } else {
                    if (stryMutAct_9fa48("3033")) {
                      {}
                    } else {
                      stryCov_9fa48("3033");
                      logger.debug(stryMutAct_9fa48("3034") ? "" : (stryCov_9fa48("3034"), 'Skipping duplicate item'), stryMutAct_9fa48("3035") ? {} : (stryCov_9fa48("3035"), {
                        name: item.name,
                        type: item.type,
                        sourceId: item.sourceId
                      }));
                    }
                  }
                }
              }
            }
          } catch (error) {
            if (stryMutAct_9fa48("3036")) {
              {}
            } else {
              stryCov_9fa48("3036");
              logger.error(stryMutAct_9fa48("3037") ? "" : (stryCov_9fa48("3037"), 'Failed to load entry'), stryMutAct_9fa48("3038") ? {} : (stryCov_9fa48("3038"), {
                entry,
                error
              }));
            }
          }
        }
      }

      // 名前でソート
      stryMutAct_9fa48("3039") ? allItems : (stryCov_9fa48("3039"), allItems.sort(stryMutAct_9fa48("3040") ? () => undefined : (stryCov_9fa48("3040"), (a, b) => a.name.localeCompare(b.name))));

      // キャッシュを更新
      this.cache.set(cacheKey, stryMutAct_9fa48("3041") ? {} : (stryCov_9fa48("3041"), {
        items: allItems,
        timestamp: Date.now()
      }));
      logger.info(stryMutAct_9fa48("3042") ? "" : (stryCov_9fa48("3042"), 'MdSearch items loaded'), stryMutAct_9fa48("3043") ? {} : (stryCov_9fa48("3043"), {
        total: allItems.length,
        commands: stryMutAct_9fa48("3044") ? allItems.length : (stryCov_9fa48("3044"), allItems.filter(stryMutAct_9fa48("3045") ? () => undefined : (stryCov_9fa48("3045"), i => stryMutAct_9fa48("3048") ? i.type !== 'command' : stryMutAct_9fa48("3047") ? false : stryMutAct_9fa48("3046") ? true : (stryCov_9fa48("3046", "3047", "3048"), i.type === (stryMutAct_9fa48("3049") ? "" : (stryCov_9fa48("3049"), 'command'))))).length),
        mentions: stryMutAct_9fa48("3050") ? allItems.length : (stryCov_9fa48("3050"), allItems.filter(stryMutAct_9fa48("3051") ? () => undefined : (stryCov_9fa48("3051"), i => stryMutAct_9fa48("3054") ? i.type !== 'mention' : stryMutAct_9fa48("3053") ? false : stryMutAct_9fa48("3052") ? true : (stryCov_9fa48("3052", "3053", "3054"), i.type === (stryMutAct_9fa48("3055") ? "" : (stryCov_9fa48("3055"), 'mention'))))).length)
      }));
      return allItems;
    }
  }

  /**
   * 単一エントリをロード
   */
  private async loadEntry(entry: MdSearchEntry): Promise<MdSearchItem[]> {
    if (stryMutAct_9fa48("3056")) {
      {}
    } else {
      stryCov_9fa48("3056");
      // パスを展開（~をホームディレクトリに置換）
      const expandedPath = entry.path.replace(stryMutAct_9fa48("3057") ? /~/ : (stryCov_9fa48("3057"), /^~/), os.homedir());

      // ディレクトリの存在確認
      try {
        if (stryMutAct_9fa48("3058")) {
          {}
        } else {
          stryCov_9fa48("3058");
          const stats = await fs.stat(expandedPath);
          if (stryMutAct_9fa48("3061") ? false : stryMutAct_9fa48("3060") ? true : stryMutAct_9fa48("3059") ? stats.isDirectory() : (stryCov_9fa48("3059", "3060", "3061"), !stats.isDirectory())) {
            if (stryMutAct_9fa48("3062")) {
              {}
            } else {
              stryCov_9fa48("3062");
              logger.warn(stryMutAct_9fa48("3063") ? "" : (stryCov_9fa48("3063"), 'MdSearch path is not a directory'), stryMutAct_9fa48("3064") ? {} : (stryCov_9fa48("3064"), {
                path: expandedPath
              }));
              return stryMutAct_9fa48("3065") ? ["Stryker was here"] : (stryCov_9fa48("3065"), []);
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("3066")) {
          {}
        } else {
          stryCov_9fa48("3066");
          if (stryMutAct_9fa48("3069") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("3068") ? false : stryMutAct_9fa48("3067") ? true : (stryCov_9fa48("3067", "3068", "3069"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("3070") ? "" : (stryCov_9fa48("3070"), 'ENOENT')))) {
            if (stryMutAct_9fa48("3071")) {
              {}
            } else {
              stryCov_9fa48("3071");
              logger.debug(stryMutAct_9fa48("3072") ? "" : (stryCov_9fa48("3072"), 'MdSearch directory does not exist'), stryMutAct_9fa48("3073") ? {} : (stryCov_9fa48("3073"), {
                path: expandedPath
              }));
              return stryMutAct_9fa48("3074") ? ["Stryker was here"] : (stryCov_9fa48("3074"), []);
            }
          }
          throw error;
        }
      }

      // パターンでファイルを検索
      const files = await this.findFiles(expandedPath, entry.pattern);
      const items: MdSearchItem[] = stryMutAct_9fa48("3075") ? ["Stryker was here"] : (stryCov_9fa48("3075"), []);
      const sourceId = stryMutAct_9fa48("3076") ? `` : (stryCov_9fa48("3076"), `${entry.path}:${entry.pattern}`);
      for (const filePath of files) {
        if (stryMutAct_9fa48("3077")) {
          {}
        } else {
          stryCov_9fa48("3077");
          try {
            if (stryMutAct_9fa48("3078")) {
              {}
            } else {
              stryCov_9fa48("3078");
              const content = await fs.readFile(filePath, stryMutAct_9fa48("3079") ? "" : (stryCov_9fa48("3079"), 'utf8'));
              const frontmatter = parseFrontmatter(content);
              const rawFrontmatter = extractRawFrontmatter(content);
              const basename = getBasename(filePath);
              const context = stryMutAct_9fa48("3080") ? {} : (stryCov_9fa48("3080"), {
                basename,
                frontmatter
              });
              const item: MdSearchItem = stryMutAct_9fa48("3081") ? {} : (stryCov_9fa48("3081"), {
                name: resolveTemplate(entry.name, context),
                description: resolveTemplate(entry.description, context),
                type: entry.type,
                filePath,
                sourceId
              });

              // オプションフィールドを追加
              if (stryMutAct_9fa48("3083") ? false : stryMutAct_9fa48("3082") ? true : (stryCov_9fa48("3082", "3083"), rawFrontmatter)) {
                if (stryMutAct_9fa48("3084")) {
                  {}
                } else {
                  stryCov_9fa48("3084");
                  item.frontmatter = rawFrontmatter;
                }
              }
              if (stryMutAct_9fa48("3086") ? false : stryMutAct_9fa48("3085") ? true : (stryCov_9fa48("3085", "3086"), entry.argumentHint)) {
                if (stryMutAct_9fa48("3087")) {
                  {}
                } else {
                  stryCov_9fa48("3087");
                  const resolvedHint = resolveTemplate(entry.argumentHint, context);
                  if (stryMutAct_9fa48("3089") ? false : stryMutAct_9fa48("3088") ? true : (stryCov_9fa48("3088", "3089"), resolvedHint)) {
                    if (stryMutAct_9fa48("3090")) {
                      {}
                    } else {
                      stryCov_9fa48("3090");
                      item.argumentHint = resolvedHint;
                    }
                  }
                }
              }

              // inputFormatを追加（設定されている場合のみ）
              if (stryMutAct_9fa48("3092") ? false : stryMutAct_9fa48("3091") ? true : (stryCov_9fa48("3091", "3092"), entry.inputFormat)) {
                if (stryMutAct_9fa48("3093")) {
                  {}
                } else {
                  stryCov_9fa48("3093");
                  item.inputFormat = entry.inputFormat;
                }
              }
              items.push(item);
            }
          } catch (error) {
            if (stryMutAct_9fa48("3094")) {
              {}
            } else {
              stryCov_9fa48("3094");
              logger.warn(stryMutAct_9fa48("3095") ? "" : (stryCov_9fa48("3095"), 'Failed to parse file'), stryMutAct_9fa48("3096") ? {} : (stryCov_9fa48("3096"), {
                filePath,
                error
              }));
            }
          }
        }
      }
      logger.debug(stryMutAct_9fa48("3097") ? "" : (stryCov_9fa48("3097"), 'MdSearch entry loaded'), stryMutAct_9fa48("3098") ? {} : (stryCov_9fa48("3098"), {
        sourceId,
        count: items.length
      }));
      return items;
    }
  }

  /**
   * パターンに一致するファイルを検索
   * サポートするパターン:
   * - "*.md" - ルート直下の .md ファイル
   * - "SKILL.md" - 具体的なファイル名
   * - "**\/*.md" - 再帰的な .md ファイル検索
   * - "**\/commands/*.md" - 再帰的に commands ディレクトリを探して .md ファイル
   * - "**\/*\/SKILL.md" - 再帰的な任意ディレクトリ内の SKILL.md
   * - "**\/{commands,agents}/*.md" - ブレース展開対応
   */
  private async findFiles(directory: string, pattern: string): Promise<string[]> {
    if (stryMutAct_9fa48("3099")) {
      {}
    } else {
      stryCov_9fa48("3099");
      // ブレース展開を処理（例: {commands,agents} → ['commands', 'agents']）
      const expandedPatterns = this.expandBraces(pattern);
      const allFiles: string[] = stryMutAct_9fa48("3100") ? ["Stryker was here"] : (stryCov_9fa48("3100"), []);
      for (const expandedPattern of expandedPatterns) {
        if (stryMutAct_9fa48("3101")) {
          {}
        } else {
          stryCov_9fa48("3101");
          const files = await this.findFilesWithPattern(directory, expandedPattern, stryMutAct_9fa48("3102") ? "Stryker was here!" : (stryCov_9fa48("3102"), ''));
          allFiles.push(...files);
        }
      }

      // 重複を除去
      return stryMutAct_9fa48("3103") ? [] : (stryCov_9fa48("3103"), [...new Set(allFiles)]);
    }
  }

  /**
   * ブレース展開を処理
   * 例: "**\/{commands,agents}/*.md" → ["**\/commands/*.md", "**\/agents/*.md"]
   */
  private expandBraces(pattern: string): string[] {
    if (stryMutAct_9fa48("3104")) {
      {}
    } else {
      stryCov_9fa48("3104");
      const braceMatch = pattern.match(stryMutAct_9fa48("3106") ? /\{([}]+)\}/ : stryMutAct_9fa48("3105") ? /\{([^}])\}/ : (stryCov_9fa48("3105", "3106"), /\{([^}]+)\}/));
      if (stryMutAct_9fa48("3109") ? !braceMatch && !braceMatch[1] : stryMutAct_9fa48("3108") ? false : stryMutAct_9fa48("3107") ? true : (stryCov_9fa48("3107", "3108", "3109"), (stryMutAct_9fa48("3110") ? braceMatch : (stryCov_9fa48("3110"), !braceMatch)) || (stryMutAct_9fa48("3111") ? braceMatch[1] : (stryCov_9fa48("3111"), !braceMatch[1])))) {
        if (stryMutAct_9fa48("3112")) {
          {}
        } else {
          stryCov_9fa48("3112");
          return stryMutAct_9fa48("3113") ? [] : (stryCov_9fa48("3113"), [pattern]);
        }
      }
      const fullMatch = braceMatch[0];
      const content = braceMatch[1];
      const alternatives = content.split(stryMutAct_9fa48("3114") ? "" : (stryCov_9fa48("3114"), ',')).map(stryMutAct_9fa48("3115") ? () => undefined : (stryCov_9fa48("3115"), s => stryMutAct_9fa48("3116") ? s : (stryCov_9fa48("3116"), s.trim())));
      const prefix = stryMutAct_9fa48("3117") ? pattern : (stryCov_9fa48("3117"), pattern.slice(0, braceMatch.index));
      const suffix = stryMutAct_9fa48("3118") ? pattern : (stryCov_9fa48("3118"), pattern.slice(stryMutAct_9fa48("3119") ? (braceMatch.index ?? 0) - fullMatch.length : (stryCov_9fa48("3119"), (stryMutAct_9fa48("3120") ? braceMatch.index && 0 : (stryCov_9fa48("3120"), braceMatch.index ?? 0)) + fullMatch.length)));
      const results: string[] = stryMutAct_9fa48("3121") ? ["Stryker was here"] : (stryCov_9fa48("3121"), []);
      for (const alt of alternatives) {
        if (stryMutAct_9fa48("3122")) {
          {}
        } else {
          stryCov_9fa48("3122");
          const expanded = stryMutAct_9fa48("3123") ? prefix + alt - suffix : (stryCov_9fa48("3123"), (stryMutAct_9fa48("3124") ? prefix - alt : (stryCov_9fa48("3124"), prefix + alt)) + suffix);
          // 再帰的にブレース展開を処理
          results.push(...this.expandBraces(expanded));
        }
      }
      return results;
    }
  }

  /**
   * パターンに一致するファイルを再帰的に検索
   * @param directory 検索対象ディレクトリ
   * @param pattern 検索パターン
   * @param relativePath ルートからの相対パス（パターンマッチング用）
   */
  private async findFilesWithPattern(directory: string, pattern: string, relativePath: string): Promise<string[]> {
    if (stryMutAct_9fa48("3125")) {
      {}
    } else {
      stryCov_9fa48("3125");
      const files: string[] = stryMutAct_9fa48("3126") ? ["Stryker was here"] : (stryCov_9fa48("3126"), []);

      // パターンを解析
      const parsed = this.parsePattern(pattern);
      try {
        if (stryMutAct_9fa48("3127")) {
          {}
        } else {
          stryCov_9fa48("3127");
          const entries = await fs.readdir(directory, stryMutAct_9fa48("3128") ? {} : (stryCov_9fa48("3128"), {
            withFileTypes: stryMutAct_9fa48("3129") ? false : (stryCov_9fa48("3129"), true)
          }));
          for (const entry of entries) {
            if (stryMutAct_9fa48("3130")) {
              {}
            } else {
              stryCov_9fa48("3130");
              const fullPath = path.join(directory, entry.name);
              const entryRelativePath = relativePath ? stryMutAct_9fa48("3131") ? `` : (stryCov_9fa48("3131"), `${relativePath}/${entry.name}`) : entry.name;
              if (stryMutAct_9fa48("3133") ? false : stryMutAct_9fa48("3132") ? true : (stryCov_9fa48("3132", "3133"), entry.isDirectory())) {
                if (stryMutAct_9fa48("3134")) {
                  {}
                } else {
                  stryCov_9fa48("3134");
                  if (stryMutAct_9fa48("3136") ? false : stryMutAct_9fa48("3135") ? true : (stryCov_9fa48("3135", "3136"), parsed.isRecursive)) {
                    if (stryMutAct_9fa48("3137")) {
                      {}
                    } else {
                      stryCov_9fa48("3137");
                      // 再帰検索
                      if (stryMutAct_9fa48("3139") ? false : stryMutAct_9fa48("3138") ? true : (stryCov_9fa48("3138", "3139"), parsed.intermediatePattern)) {
                        if (stryMutAct_9fa48("3140")) {
                          {}
                        } else {
                          stryCov_9fa48("3140");
                          // 中間パターンがある場合（例: **/commands/*.md, **/plugins/*/commands/*.md）
                          // パスの末尾が中間パターンにマッチするか確認
                          if (stryMutAct_9fa48("3142") ? false : stryMutAct_9fa48("3141") ? true : (stryCov_9fa48("3141", "3142"), this.matchesIntermediatePathSuffix(entryRelativePath, parsed.intermediatePattern))) {
                            if (stryMutAct_9fa48("3143")) {
                              {}
                            } else {
                              stryCov_9fa48("3143");
                              // 中間パスにマッチした場合、その中でファイルを検索
                              const subFiles = await this.findFilesInDir(fullPath, parsed.filePattern);
                              files.push(...subFiles);
                            }
                          }
                        }
                      }
                      // 常に再帰的にサブディレクトリも検索
                      const subFiles = await this.findFilesWithPattern(fullPath, pattern, entryRelativePath);
                      files.push(...subFiles);
                    }
                  }
                }
              } else if (stryMutAct_9fa48("3145") ? false : stryMutAct_9fa48("3144") ? true : (stryCov_9fa48("3144", "3145"), entry.isFile())) {
                if (stryMutAct_9fa48("3146")) {
                  {}
                } else {
                  stryCov_9fa48("3146");
                  // ファイルがパターンに一致するか確認
                  if (stryMutAct_9fa48("3148") ? false : stryMutAct_9fa48("3147") ? true : (stryCov_9fa48("3147", "3148"), this.matchesFilePattern(entry.name, entryRelativePath, parsed))) {
                    if (stryMutAct_9fa48("3149")) {
                      {}
                    } else {
                      stryCov_9fa48("3149");
                      files.push(fullPath);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("3150")) {
          {}
        } else {
          stryCov_9fa48("3150");
          // ディレクトリ読み取りエラーは無視（権限エラー等）
          logger.debug(stryMutAct_9fa48("3151") ? "" : (stryCov_9fa48("3151"), 'Failed to read directory'), stryMutAct_9fa48("3152") ? {} : (stryCov_9fa48("3152"), {
            directory,
            error
          }));
        }
      }
      return files;
    }
  }

  /**
   * ディレクトリ内のファイルを検索（再帰なし）
   */
  private async findFilesInDir(directory: string, filePattern: string): Promise<string[]> {
    if (stryMutAct_9fa48("3153")) {
      {}
    } else {
      stryCov_9fa48("3153");
      const files: string[] = stryMutAct_9fa48("3154") ? ["Stryker was here"] : (stryCov_9fa48("3154"), []);
      try {
        if (stryMutAct_9fa48("3155")) {
          {}
        } else {
          stryCov_9fa48("3155");
          const entries = await fs.readdir(directory, stryMutAct_9fa48("3156") ? {} : (stryCov_9fa48("3156"), {
            withFileTypes: stryMutAct_9fa48("3157") ? false : (stryCov_9fa48("3157"), true)
          }));
          for (const entry of entries) {
            if (stryMutAct_9fa48("3158")) {
              {}
            } else {
              stryCov_9fa48("3158");
              if (stryMutAct_9fa48("3161") ? entry.isFile() || this.matchesGlobPattern(entry.name, filePattern) : stryMutAct_9fa48("3160") ? false : stryMutAct_9fa48("3159") ? true : (stryCov_9fa48("3159", "3160", "3161"), entry.isFile() && this.matchesGlobPattern(entry.name, filePattern))) {
                if (stryMutAct_9fa48("3162")) {
                  {}
                } else {
                  stryCov_9fa48("3162");
                  files.push(path.join(directory, entry.name));
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("3163")) {
          {}
        } else {
          stryCov_9fa48("3163");
          logger.debug(stryMutAct_9fa48("3164") ? "" : (stryCov_9fa48("3164"), 'Failed to read directory'), stryMutAct_9fa48("3165") ? {} : (stryCov_9fa48("3165"), {
            directory,
            error
          }));
        }
      }
      return files;
    }
  }

  /**
   * パターンを解析
   */
  private parsePattern(pattern: string): {
    isRecursive: boolean;
    intermediatePattern: string | null;
    filePattern: string;
  } {
    if (stryMutAct_9fa48("3166")) {
      {}
    } else {
      stryCov_9fa48("3166");
      const isRecursive = stryMutAct_9fa48("3167") ? pattern.endsWith('**/') : (stryCov_9fa48("3167"), pattern.startsWith(stryMutAct_9fa48("3168") ? "" : (stryCov_9fa48("3168"), '**/')));
      if (stryMutAct_9fa48("3171") ? false : stryMutAct_9fa48("3170") ? true : stryMutAct_9fa48("3169") ? isRecursive : (stryCov_9fa48("3169", "3170", "3171"), !isRecursive)) {
        if (stryMutAct_9fa48("3172")) {
          {}
        } else {
          stryCov_9fa48("3172");
          return stryMutAct_9fa48("3173") ? {} : (stryCov_9fa48("3173"), {
            isRecursive: stryMutAct_9fa48("3174") ? true : (stryCov_9fa48("3174"), false),
            intermediatePattern: null,
            filePattern: pattern
          });
        }
      }

      // "**/" を除去
      const withoutPrefix = stryMutAct_9fa48("3175") ? pattern : (stryCov_9fa48("3175"), pattern.slice(3));

      // 中間パスとファイルパターンを分離
      const lastSlashIndex = withoutPrefix.lastIndexOf(stryMutAct_9fa48("3176") ? "" : (stryCov_9fa48("3176"), '/'));
      if (stryMutAct_9fa48("3179") ? lastSlashIndex !== -1 : stryMutAct_9fa48("3178") ? false : stryMutAct_9fa48("3177") ? true : (stryCov_9fa48("3177", "3178", "3179"), lastSlashIndex === (stryMutAct_9fa48("3180") ? +1 : (stryCov_9fa48("3180"), -1)))) {
        if (stryMutAct_9fa48("3181")) {
          {}
        } else {
          stryCov_9fa48("3181");
          // "**/*.md" のようなパターン
          return stryMutAct_9fa48("3182") ? {} : (stryCov_9fa48("3182"), {
            isRecursive: stryMutAct_9fa48("3183") ? false : (stryCov_9fa48("3183"), true),
            intermediatePattern: null,
            filePattern: withoutPrefix
          });
        }
      }

      // "**/commands/*.md" または "**/*/SKILL.md" のようなパターン
      const intermediatePattern = stryMutAct_9fa48("3184") ? withoutPrefix : (stryCov_9fa48("3184"), withoutPrefix.slice(0, lastSlashIndex));
      const filePattern = stryMutAct_9fa48("3185") ? withoutPrefix : (stryCov_9fa48("3185"), withoutPrefix.slice(stryMutAct_9fa48("3186") ? lastSlashIndex - 1 : (stryCov_9fa48("3186"), lastSlashIndex + 1)));
      return stryMutAct_9fa48("3187") ? {} : (stryCov_9fa48("3187"), {
        isRecursive: stryMutAct_9fa48("3188") ? false : (stryCov_9fa48("3188"), true),
        intermediatePattern,
        filePattern
      });
    }
  }

  /**
   * 相対パスの末尾が中間パターンにマッチするか確認
   * 例: "project1/commands" が "commands" にマッチ（末尾が一致）
   * 例: "plugins/my-plugin/commands" が "plugins/star/commands" にマッチ (star=*)
   * 例: "plugin1" が "*" にマッチ
   */
  private matchesIntermediatePathSuffix(relativePath: string, intermediatePattern: string): boolean {
    if (stryMutAct_9fa48("3189")) {
      {}
    } else {
      stryCov_9fa48("3189");
      const pathSegments = relativePath.split(stryMutAct_9fa48("3190") ? "" : (stryCov_9fa48("3190"), '/'));
      const patternSegments = intermediatePattern.split(stryMutAct_9fa48("3191") ? "" : (stryCov_9fa48("3191"), '/'));

      // パスセグメント数がパターンセグメント数より少ない場合はマッチしない
      if (stryMutAct_9fa48("3195") ? pathSegments.length >= patternSegments.length : stryMutAct_9fa48("3194") ? pathSegments.length <= patternSegments.length : stryMutAct_9fa48("3193") ? false : stryMutAct_9fa48("3192") ? true : (stryCov_9fa48("3192", "3193", "3194", "3195"), pathSegments.length < patternSegments.length)) {
        if (stryMutAct_9fa48("3196")) {
          {}
        } else {
          stryCov_9fa48("3196");
          return stryMutAct_9fa48("3197") ? true : (stryCov_9fa48("3197"), false);
        }
      }

      // パスの末尾からパターンをマッチさせる
      const startIndex = stryMutAct_9fa48("3198") ? pathSegments.length + patternSegments.length : (stryCov_9fa48("3198"), pathSegments.length - patternSegments.length);
      for (let i = 0; stryMutAct_9fa48("3201") ? i >= patternSegments.length : stryMutAct_9fa48("3200") ? i <= patternSegments.length : stryMutAct_9fa48("3199") ? false : (stryCov_9fa48("3199", "3200", "3201"), i < patternSegments.length); stryMutAct_9fa48("3202") ? i-- : (stryCov_9fa48("3202"), i++)) {
        if (stryMutAct_9fa48("3203")) {
          {}
        } else {
          stryCov_9fa48("3203");
          const pathSeg = pathSegments[stryMutAct_9fa48("3204") ? startIndex - i : (stryCov_9fa48("3204"), startIndex + i)];
          const patternSeg = patternSegments[i];
          if (stryMutAct_9fa48("3207") ? pathSeg === undefined && patternSeg === undefined : stryMutAct_9fa48("3206") ? false : stryMutAct_9fa48("3205") ? true : (stryCov_9fa48("3205", "3206", "3207"), (stryMutAct_9fa48("3209") ? pathSeg !== undefined : stryMutAct_9fa48("3208") ? false : (stryCov_9fa48("3208", "3209"), pathSeg === undefined)) || (stryMutAct_9fa48("3211") ? patternSeg !== undefined : stryMutAct_9fa48("3210") ? false : (stryCov_9fa48("3210", "3211"), patternSeg === undefined)))) {
            if (stryMutAct_9fa48("3212")) {
              {}
            } else {
              stryCov_9fa48("3212");
              return stryMutAct_9fa48("3213") ? true : (stryCov_9fa48("3213"), false);
            }
          }
          if (stryMutAct_9fa48("3216") ? false : stryMutAct_9fa48("3215") ? true : stryMutAct_9fa48("3214") ? this.matchesGlobPattern(pathSeg, patternSeg) : (stryCov_9fa48("3214", "3215", "3216"), !this.matchesGlobPattern(pathSeg, patternSeg))) {
            if (stryMutAct_9fa48("3217")) {
              {}
            } else {
              stryCov_9fa48("3217");
              return stryMutAct_9fa48("3218") ? true : (stryCov_9fa48("3218"), false);
            }
          }
        }
      }
      return stryMutAct_9fa48("3219") ? false : (stryCov_9fa48("3219"), true);
    }
  }

  /**
   * ファイルがパターンに一致するか確認
   */
  private matchesFilePattern(fileName: string, relativePath: string, parsed: {
    isRecursive: boolean;
    intermediatePattern: string | null;
    filePattern: string;
  }): boolean {
    if (stryMutAct_9fa48("3220")) {
      {}
    } else {
      stryCov_9fa48("3220");
      if (stryMutAct_9fa48("3223") ? false : stryMutAct_9fa48("3222") ? true : stryMutAct_9fa48("3221") ? parsed.isRecursive : (stryCov_9fa48("3221", "3222", "3223"), !parsed.isRecursive)) {
        if (stryMutAct_9fa48("3224")) {
          {}
        } else {
          stryCov_9fa48("3224");
          // 非再帰パターン: ルート直下のみ
          return stryMutAct_9fa48("3227") ? relativePath === fileName || this.matchesGlobPattern(fileName, parsed.filePattern) : stryMutAct_9fa48("3226") ? false : stryMutAct_9fa48("3225") ? true : (stryCov_9fa48("3225", "3226", "3227"), (stryMutAct_9fa48("3229") ? relativePath !== fileName : stryMutAct_9fa48("3228") ? true : (stryCov_9fa48("3228", "3229"), relativePath === fileName)) && this.matchesGlobPattern(fileName, parsed.filePattern));
        }
      }
      if (stryMutAct_9fa48("3231") ? false : stryMutAct_9fa48("3230") ? true : (stryCov_9fa48("3230", "3231"), parsed.intermediatePattern)) {
        if (stryMutAct_9fa48("3232")) {
          {}
        } else {
          stryCov_9fa48("3232");
          // 中間パターンがある場合は、findFilesInDirで処理されるため、ここでは false
          return stryMutAct_9fa48("3233") ? true : (stryCov_9fa48("3233"), false);
        }
      }

      // "**/*.md" のような単純な再帰パターン
      return this.matchesGlobPattern(fileName, parsed.filePattern);
    }
  }

  /**
   * ファイル名/ディレクトリ名がglobパターンに一致するか確認
   * サポートするパターン:
   * - "*.md" - ワイルドカード + 拡張子
   * - "*" - 全てにマッチ
   * - "SKILL.md" - 具体的なファイル名
   * - "test-*.md" - 前方一致 + ワイルドカード
   * - "*-test.md" - ワイルドカード + 後方一致
   */
  private matchesGlobPattern(name: string, pattern: string): boolean {
    if (stryMutAct_9fa48("3234")) {
      {}
    } else {
      stryCov_9fa48("3234");
      // "*" は全てにマッチ
      if (stryMutAct_9fa48("3237") ? pattern !== '*' : stryMutAct_9fa48("3236") ? false : stryMutAct_9fa48("3235") ? true : (stryCov_9fa48("3235", "3236", "3237"), pattern === (stryMutAct_9fa48("3238") ? "" : (stryCov_9fa48("3238"), '*')))) {
        if (stryMutAct_9fa48("3239")) {
          {}
        } else {
          stryCov_9fa48("3239");
          return stryMutAct_9fa48("3240") ? false : (stryCov_9fa48("3240"), true);
        }
      }

      // パターンを正規表現に変換
      const regexPattern = pattern.replace(stryMutAct_9fa48("3241") ? /[^.+^${}()|[\]\\]/g : (stryCov_9fa48("3241"), /[.+^${}()|[\]\\]/g), stryMutAct_9fa48("3242") ? "" : (stryCov_9fa48("3242"), '\\$&')) // 特殊文字をエスケープ
      .replace(/\*/g, stryMutAct_9fa48("3243") ? "" : (stryCov_9fa48("3243"), '.*')) // * を .* に変換
      .replace(/\?/g, stryMutAct_9fa48("3244") ? "" : (stryCov_9fa48("3244"), '.')); // ? を . に変換

      const regex = new RegExp(stryMutAct_9fa48("3245") ? `` : (stryCov_9fa48("3245"), `^${regexPattern}$`));
      return regex.test(name);
    }
  }
}
export default MdSearchLoader;