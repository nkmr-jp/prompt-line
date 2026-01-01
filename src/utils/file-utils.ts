import { promises as fs } from 'fs';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Set restrictive directory permissions (owner read/write/execute only)
      await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
    } else {
      throw error;
    }
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
