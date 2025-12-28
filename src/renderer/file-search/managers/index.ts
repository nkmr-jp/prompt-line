/**
 * File Search Managers - Specialized manager classes for file search functionality
 */

export { PopupManager } from './popup-manager';
export type { PopupManagerCallbacks } from './popup-manager';

export { SettingsCacheManager } from './settings-cache-manager';

export { DirectoryCacheManager } from './directory-cache-manager';
export type { DirectoryCacheCallbacks } from './directory-cache-manager';

export { HighlightManager } from './highlight-manager';
export type { HighlightManagerCallbacks, DirectoryDataForHighlight } from './highlight-manager';

export { FileOpenerEventHandler } from './file-opener-event-handler';
export type { FileOpenerCallbacks } from './file-opener-event-handler';

export { CodeSearchManager } from './code-search-manager';
export type { CodeSearchManagerCallbacks } from './code-search-manager';

export { FileFilterManager } from './file-filter-manager';
export type { FileFilterCallbacks } from './file-filter-manager';

export { PathManager } from './path-manager';
export type { PathManagerCallbacks, DirectoryDataForScanner } from './path-manager';

export { NavigationManager } from './navigation-manager';
export type { NavigationCallbacks } from './navigation-manager';

export { EventListenerManager } from './event-listener-manager';
export type { EventListenerCallbacks } from './event-listener-manager';

export { QueryExtractionManager } from './query-extraction-manager';
export type { QueryExtractionResult, CodeSearchQueryResult, QueryExtractionCallbacks } from './query-extraction-manager';

export { SuggestionUIManager } from './suggestion-ui-manager';
export type { SuggestionUICallbacks } from './suggestion-ui-manager';

export { FileSearchState } from './file-search-state';
