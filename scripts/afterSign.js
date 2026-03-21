const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CERT_NAME = 'Prompt Line';

/**
 * Detect the best available signing identity.
 * Priority: CODE_SIGN_IDENTITY env var > "Prompt Line" certificate > ad-hoc ("-")
 */
function getSigningIdentity() {
  const envIdentity = process.env.CODE_SIGN_IDENTITY;
  if (envIdentity) {
    console.log(`Using signing identity from CODE_SIGN_IDENTITY: ${envIdentity}`);
    return envIdentity;
  }

  try {
    const result = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    if (result.includes(`"${CERT_NAME}"`)) {
      console.log(`Found "${CERT_NAME}" certificate in keychain`);
      return CERT_NAME;
    }
  } catch {
    // security command failed, fall back to ad-hoc
  }

  console.log('No signing certificate found, using ad-hoc signing');
  return '-';
}

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`App Path: ${appPath}`);

  // Use build/entitlements.mac.plist file
  const entitlementsPath = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');
  
  if (!fs.existsSync(entitlementsPath)) {
    throw new Error(`Entitlements file not found: ${entitlementsPath}`);
  }
  
  console.log(`Entitlements file: ${entitlementsPath}`);

  try {
    const identity = getSigningIdentity();
    const identityLabel = identity === '-' ? 'ad-hoc' : `"${identity}"`;

    // Sign native binaries individually (electron-builder doesn't sign unpacked binaries)
    console.log('Signing native binaries...');
    await signNativeBinaries(appPath, identity);

    // Re-sign entire app bundle (--deep) to ensure consistent Team ID across all components
    console.log(`Re-signing app bundle with ${identityLabel} signature...`);
    execSync(`codesign --force --deep --sign "${identity}" --entitlements "${entitlementsPath}" "${appPath}"`);

    console.log('Verifying signature...');
    execSync(`codesign --verify --verbose "${appPath}"`);

    console.log('Running security verification...');
    await runSecurityChecks(appPath);

    console.log(`✅ Code signing completed successfully (${identityLabel})`);
  } catch (error) {
    console.error('Code signing error:', error);
    throw error;
  }
};

// Native binary signing function
async function signNativeBinaries(appPath, identity) {
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
      execSync(`codesign --force --sign "${identity}" "${binaryPath}"`);
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