#!/usr/bin/env node
/**
 * purification / skeletonize CLI Launcher (Standalone & Global).
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function main() {
    let scriptPath = path.resolve(__dirname, '..', 'purification.py');
    if (!fs.existsSync(scriptPath)) {
        scriptPath = path.join(os.homedir(), 'Documents', 'scripts', 'purification', 'purification.py');
    }

    if (!fs.existsSync(scriptPath)) {
        console.error(`Error: Could not locate purification engine at ${scriptPath}`);
        process.exit(1);
    }

    const child = spawn('python3', [scriptPath, ...process.argv.slice(2)], {
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        process.exit(code ?? 0);
    });
}

main();