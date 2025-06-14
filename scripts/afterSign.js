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

  console.log('=== Custom Code Signing Process ===');
  console.log(`App Path: ${appPath}`);

  // Use build/entitlements.mac.plist file
  const entitlementsPath = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');
  
  if (!fs.existsSync(entitlementsPath)) {
    throw new Error(`Entitlements file not found: ${entitlementsPath}`);
  }
  
  console.log(`Entitlements file: ${entitlementsPath}`);

  try {
    // Remove from accessibility permissions list using bundle identifier
    console.log('Removing from accessibility permissions list...');
    try {
      execSync(`tccutil reset Accessibility com.electron.prompt-line`);
      console.log('✅ Successfully removed from accessibility list');
    } catch (tccError) {
      console.warn('⚠️ Failed to remove from accessibility list (this is normal on some systems):', tccError.message);
    }
    
    // Remove existing signature
    console.log('Removing existing signature...');
    execSync(`codesign --remove-signature "${appPath}"`);
    
    // Apply ad-hoc signature
    console.log('Applying ad-hoc signature...');
    execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appPath}"`);
    
    // Verify signature
    console.log('Verifying signature...');
    execSync(`codesign --verify --verbose "${appPath}"`);
    
    console.log('✅ Code signing completed successfully');
  } catch (error) {
    console.error('Code signing error:', error);
    throw error;
  }
};