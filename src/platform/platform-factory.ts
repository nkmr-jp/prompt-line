import { IPlatformTools } from './platform-interface';
import { MacPlatformTools } from './mac-platform-tools';
import { WindowsPlatformTools } from './windows-platform-tools';

let platformTools: IPlatformTools | null = null;

export function createPlatformTools(): IPlatformTools {
  if (platformTools) {
    return platformTools;
  }

  if (process.platform === 'darwin') {
    platformTools = new MacPlatformTools();
  } else if (process.platform === 'win32') {
    platformTools = new WindowsPlatformTools();
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  return platformTools;
}

export function getPlatform(): 'mac' | 'windows' | 'unknown' {
  if (process.platform === 'darwin') {
    return 'mac';
  } else if (process.platform === 'win32') {
    return 'windows';
  }
  return 'unknown';
}