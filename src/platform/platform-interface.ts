export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppInfo {
  name: string;
  bundleId?: string | null;
}

export interface TextFieldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isEnabled?: boolean;
  hasText?: boolean;
}

export interface IPlatformTools {
  getActiveWindowBounds(): Promise<WindowBounds | null>;
  getCurrentApp(): Promise<AppInfo | null>;
  pasteText(): Promise<void>;
  activateApp(identifier: string, useBundle?: boolean): Promise<void>;
  activateAndPaste(identifier: string, useBundle?: boolean): Promise<void>;
  getActiveTextFieldBounds(): Promise<TextFieldBounds | null>;
  checkAccessibilityPermissions(): Promise<boolean>;
}