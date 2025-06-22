const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log('=== Enhanced Custom Code Signing Process ===');
  console.log(`App Path: ${appPath}`);

  // Use build/entitlements.mac.plist file
  const entitlementsPath = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');
  
  if (!fs.existsSync(entitlementsPath)) {
    throw new Error(`Entitlements file not found: ${entitlementsPath}`);
  }
  
  console.log(`Entitlements file: ${entitlementsPath}`);

  try {
    // 既存フロー: TCCリセット
    console.log('Removing from accessibility permissions list...');
    try {
      execSync(`tccutil reset Accessibility com.electron.prompt-line`);
      console.log('✅ Successfully removed from accessibility list');
    } catch (tccError) {
      console.warn('⚠️ Failed to remove from accessibility list (normal):', tccError.message);
    }
    
    // 既存フロー: 署名削除
    console.log('Removing existing signature...');
    execSync(`codesign --remove-signature "${appPath}"`);
    
    // 🆕 新機能: ネイティブバイナリの署名
    console.log('Signing native binaries...');
    await signNativeBinaries(appPath);
    
    // 既存フロー: ad-hoc署名適用
    console.log('Applying ad-hoc signature...');
    execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appPath}"`);
    
    // 既存フロー: 署名検証
    console.log('Verifying signature...');
    execSync(`codesign --verify --verbose "${appPath}"`);
    
    // 🆕 新機能: セキュリティ検証
    console.log('Running security verification...');
    await runSecurityChecks(appPath);
    
    console.log('✅ Enhanced code signing completed successfully');
  } catch (error) {
    console.error('Code signing error:', error);
    throw error;
  }
};

// 🆕 ネイティブバイナリ署名関数
async function signNativeBinaries(appPath) {
  const binariesPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'dist', 'native-tools');
  
  if (!fs.existsSync(binariesPath)) {
    console.log('ℹ️ Native binaries not found, skipping signing');
    return;
  }

  const binaries = fs.readdirSync(binariesPath).filter(file => 
    !file.endsWith('.js') && !file.endsWith('.json') && !file.startsWith('.')
  );

  for (const binary of binaries) {
    const binaryPath = path.join(binariesPath, binary);
    try {
      // ネイティブバイナリもad-hoc署名
      execSync(`codesign --force --sign - "${binaryPath}"`);
      console.log(`✅ Signed: ${binary}`);
    } catch (error) {
      console.warn(`⚠️ Failed to sign ${binary}:`, error.message);
    }
  }
}

// 🆕 セキュリティチェック関数
async function runSecurityChecks(appPath) {
  try {
    // 署名状態の詳細確認
    console.log('📋 Checking signature details...');
    const signInfo = execSync(`codesign -dv --verbose=4 "${appPath}"`, { encoding: 'utf8' });
    console.log('Signature info:', signInfo);
    
    // entitlementsの確認
    console.log('📋 Checking active entitlements...');
    const entitlements = execSync(`codesign -d --entitlements - "${appPath}"`, { encoding: 'utf8' });
    console.log('Active entitlements:', entitlements.substring(0, 500) + '...');
    
    // 実行権限の確認
    console.log('📋 Checking executable permissions...');
    const permissions = execSync(`ls -la "${appPath}/Contents/MacOS/"`, { encoding: 'utf8' });
    console.log('Executable permissions:', permissions);
    
    // バイナリサイズの確認（異常値検出）
    const stats = fs.statSync(appPath);
    console.log(`📋 App bundle size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // セキュリティ設定の確認
    console.log('📋 Checking for security configurations...');
    
    // Main process fileはapp.asarアーカイブ内にある場合と、unpackedにある場合がある
    const appAsarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
    const mainJsUnpackedPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'dist', 'main.js');
    
    if (fs.existsSync(appAsarPath)) {
      console.log('✅ App bundle (app.asar) found');
    } else {
      console.warn('⚠️ app.asar not found');
    }
    
    if (fs.existsSync(mainJsUnpackedPath)) {
      console.log('✅ Main process file found in unpacked location');
    } else {
      console.log('ℹ️ Main process file is packaged in app.asar (normal)');
    }
    
  } catch (error) {
    console.warn('⚠️ Security check warnings:', error.message);
  }
}