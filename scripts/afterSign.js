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
    console.log('Removing existing signature...');
    execSync(`codesign --remove-signature "${appPath}"`);
    
    console.log('Signing native binaries...');
    await signNativeBinaries(appPath);
    
    console.log('Applying ad-hoc signature...');
    execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appPath}"`);
    
    console.log('Verifying signature...');
    execSync(`codesign --verify --verbose "${appPath}"`);
    
    console.log('Running security verification...');
    await runSecurityChecks(appPath);
    
    console.log('✅ Enhanced code signing completed successfully');
  } catch (error) {
    console.error('Code signing error:', error);
    throw error;
  }
};

// Native binary signing function
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
      // Apply ad-hoc signature to native binary
      execSync(`codesign --force --sign - "${binaryPath}"`);
      console.log(`✅ Signed: ${binary}`);
    } catch (error) {
      console.warn(`⚠️ Failed to sign ${binary}:`, error.message);
    }
  }
}

// Security check function
async function runSecurityChecks(appPath) {
  try {
    // Detailed signature verification
    console.log('📋 Checking signature details...');
    const signInfo = execSync(`codesign -dv --verbose=4 "${appPath}"`, { encoding: 'utf8' });
    console.log('Signature info:', signInfo);
    
    // Check entitlements
    console.log('📋 Checking active entitlements...');
    const entitlements = execSync(`codesign -d --entitlements - "${appPath}"`, { encoding: 'utf8' });
    console.log('Active entitlements:', entitlements.substring(0, 500) + '...');
    
    console.log('📋 Checking executable permissions...');
    const permissions = execSync(`ls -la "${appPath}/Contents/MacOS/"`, { encoding: 'utf8' });
    console.log('Executable permissions:', permissions);
    
    // Get actual app bundle size using du command
    const sizeOutput = execSync(`du -sh "${appPath}" | cut -f1`, { encoding: 'utf8' }).trim();
    console.log(`📋 App bundle size: ${sizeOutput}`);
    
    console.log('📋 Checking for security configurations...');
    
    // Check for main process file location
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