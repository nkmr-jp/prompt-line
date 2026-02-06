import path from 'path';

// Native tools paths - handle both packaged and development modes
function getNativeToolsPath(): string {
  try {
    // Try to import app to check if packaged
    const { app } = require('electron');

    if (app && app.isPackaged) {
      // In packaged mode, native tools are in the .asar.unpacked directory
      const appPath = app.getAppPath();
      const resourcesPath = path.dirname(appPath);
      const nativeToolsPath = path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'native-tools');

      return nativeToolsPath;
    }
  } catch {
    // App object not available (e.g., in renderer process or tests)
  }

  // Development mode or fallback
  return path.join(__dirname, '..', '..', 'native-tools');
}

const NATIVE_TOOLS_DIR = getNativeToolsPath();

export const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'window-detector');
export const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');
export const TEXT_FIELD_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'text-field-detector');
export const DIRECTORY_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'directory-detector');
export { NATIVE_TOOLS_DIR };
