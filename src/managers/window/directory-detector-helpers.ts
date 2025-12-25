import { execFile } from 'child_process';
import { logger, FILE_SEARCHER_PATH } from '../../utils/utils';
import type { DirectoryInfo } from '../../types';
import { parseFileSearcherResult } from './file-searcher-result-parser';

// Re-export for backward compatibility
export { buildFileSearcherArgs } from './file-searcher-args-builder';

/**
 * Execute file searcher and return results
 */
export async function executeFileSearcher(
  listArgs: string[],
  remainingTimeout: number,
  startTime: number
): Promise<Partial<DirectoryInfo>> {
  const listOptions = {
    timeout: remainingTimeout,
    killSignal: 'SIGTERM' as const,
    maxBuffer: 50 * 1024 * 1024 // 50MB for large file lists
  };

  logger.debug('File searcher command:', {
    executable: FILE_SEARCHER_PATH,
    args: listArgs
  });

  logger.debug('Executing file searcher with timeout:', { remainingTimeout });

  return new Promise((resolve) => {
    execFile(FILE_SEARCHER_PATH, listArgs, listOptions, (listError: Error | null, listStdout?: string) => {
      const totalElapsed = performance.now() - startTime;

      if (listError) {
        logger.warn(`File listing failed after ${totalElapsed.toFixed(2)}ms:`, listError);
        resolve({ filesError: listError.message });
        return;
      }

      const result = parseFileSearcherResult(listStdout, totalElapsed);
      resolve(result);
    });
  });
}
