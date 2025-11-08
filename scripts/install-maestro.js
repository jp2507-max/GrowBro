#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MAESTRO_VERSION = process.env.MAESTRO_VERSION || 'latest';

function installMaestro() {
  const platform = os.platform();

  if (platform !== 'linux' && platform !== 'darwin') {
    console.error('Unsupported platform:', platform);
    process.exit(1);
  }

  const homeDir = os.homedir();
  const maestroDir = path.join(homeDir, '.maestro');
  const binDir = path.join(maestroDir, 'bin');

  // Create directories
  if (!fs.existsSync(maestroDir)) {
    fs.mkdirSync(maestroDir, { recursive: true });
  }
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  if (MAESTRO_VERSION === 'latest') {
    // Use the original curl installer for latest
    console.log('Installing latest Maestro version...');
    execSync('curl -Ls "https://get.maestro.mobile.dev" | bash', {
      stdio: 'inherit',
    });
  } else {
    // Install specific version
    console.log(`Installing Maestro version ${MAESTRO_VERSION}...`);

    const zipName = `maestro.zip`;
    const zipPath = path.join(os.tmpdir(), zipName);
    const extractDir = path.join(os.tmpdir(), 'maestro-extract');

    try {
      // Clean up any previous temp files
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(extractDir))
        fs.rmSync(extractDir, { recursive: true, force: true });

      // Download specific version
      const downloadUrl = `https://github.com/mobile-dev-inc/maestro/releases/download/cli-${MAESTRO_VERSION}/maestro.zip`;
      console.log(`Downloading from: ${downloadUrl}`);

      execSync(`curl -L -o "${zipPath}" "${downloadUrl}"`, {
        stdio: 'inherit',
      });

      // Extract
      fs.mkdirSync(extractDir, { recursive: true });
      execSync(`unzip -q "${zipPath}" -d "${extractDir}"`, {
        stdio: 'inherit',
      });

      // Find the extracted binary
      const extractedFiles = fs.readdirSync(extractDir);

      if (extractedFiles.length === 0) {
        console.error('Error: No files were extracted from the ZIP archive.');
        process.exit(1);
      }

      // Skip macOS __MACOSX folders and find the actual Maestro payload directory
      const maestroDirName = extractedFiles.find((dir) => {
        if (dir === '__MACOSX') return false;
        const fullPath = path.join(extractDir, dir);
        return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
      });

      if (!maestroDirName) {
        console.error(
          'Error: Could not find Maestro payload directory in extracted files.'
        );
        process.exit(1);
      }

      const maestroDirExtracted = path.join(extractDir, maestroDirName);

      // Copy all files from the extracted maestro directory to .maestro/bin
      const sourceFiles = fs.readdirSync(maestroDirExtracted);
      for (const file of sourceFiles) {
        const sourcePath = path.join(maestroDirExtracted, file);
        const destPath = path.join(binDir, file);
        fs.cpSync(sourcePath, destPath, { recursive: true, force: true });
      }

      // Find and set executable permissions for the maestro binary
      function findMaestro(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && file === 'maestro') {
            return fullPath;
          } else if (stat.isDirectory()) {
            const found = findMaestro(fullPath);
            if (found) return found;
          }
        }
        return null;
      }

      const maestroPath = findMaestro(binDir);
      if (!maestroPath) {
        console.error('Error: Maestro binary not found after installation.');
        process.exit(1);
      }
      fs.chmodSync(maestroPath, '755');

      console.log(`Maestro ${MAESTRO_VERSION} installed successfully!`);
    } finally {
      // Cleanup
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(extractDir))
        fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }

  // Add to PATH
  console.log(`Add ${binDir} to your PATH`);
}

installMaestro();
