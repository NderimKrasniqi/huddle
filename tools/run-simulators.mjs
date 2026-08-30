#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_SERIAL = 'emulator-5554';
const ANDROID_AVD = 'huddle_tv';
const TV_BUNDLE_ID = 'tv.huddle.hub';
const SIMULATOR_ROOT = join(tmpdir(), 'huddle-simulators');
const COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 10 * 1000;
const SIMULATOR_BOOT_TIMEOUT_MS = 120 * 1000;
const ANDROID_DEVICE_TIMEOUT_MS = 120_000;

const APPLE_TARGETS = {
  phone: {
    label: 'Phone iOS',
    workspace: 'apps/phone/ios/Huddle.xcworkspace',
    generatedProject: 'apps/phone/ios',
    scheme: 'Huddle',
    platform: 'iOS Simulator',
    simulatorName: 'iPhone 17',
    sdk: 'iphonesimulator',
    configuration: 'Release',
    arch: 'x86_64',
    bundleId: 'tv.huddle.phone',
    derivedData: join(SIMULATOR_ROOT, 'phone'),
    prebuild: 'pnpm --filter @huddle/phone prebuild',
  },
  tvos: {
    label: 'TV tvOS (experimental)',
    workspace: 'apps/tv/ios/Huddle.xcworkspace',
    generatedProject: 'apps/tv/ios',
    scheme: 'Huddle',
    platform: 'tvOS Simulator',
    simulatorName: 'Apple TV 4K (3rd generation) (at 1080p)',
    sdk: 'appletvsimulator',
    configuration: 'Release',
    arch: 'x86_64',
    bundleId: TV_BUNDLE_ID,
    derivedData: join(SIMULATOR_ROOT, 'tvos'),
    prebuild: 'pnpm --filter @huddle/tv prebuild --platform ios',
  },
};

const ANDROID = {
  sdkRoot:
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Android', 'sdk')
      : process.platform === 'win32'
        ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk')
        : join(homedir(), 'Android', 'Sdk')),
};
ANDROID.adb = join(ANDROID.sdkRoot, 'platform-tools', 'adb');
ANDROID.emulator = join(ANDROID.sdkRoot, 'emulator', 'emulator');
ANDROID.gradle = join(ROOT, 'apps/tv/android/gradlew');
ANDROID.apk = join(
  ROOT,
  'apps/tv/android/app/build/outputs/apk/release/app-release.apk',
);

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) || 'status';
const dryRun = args.includes('--dry-run');

function relative(path) {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}

function printCommand(binary, commandArgs = []) {
  const rendered = [binary, ...commandArgs]
    .map((part) => (/^[\w./:=@+-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(' ');
  console.log(`$ ${rendered}`);
}

function run(binary, commandArgs = [], options = {}) {
  const {
    cwd = ROOT,
    env = process.env,
    allowFailure = false,
    timeoutMs = COMMAND_TIMEOUT_MS,
  } = options;
  printCommand(binary, commandArgs);
  if (dryRun) return '';

  const result = spawnSync(binary, commandArgs, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: timeoutMs,
  });
  if (result.error) {
    if (allowFailure) return '';
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`${binary} timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw new Error(`Could not run ${binary}: ${result.error.message}`);
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${binary} exited with status ${result.status ?? 'unknown'}`);
  }
  return '';
}

function capture(binary, commandArgs = [], options = {}) {
  const {
    cwd = ROOT,
    allowFailure = false,
    timeoutMs = PROBE_TIMEOUT_MS,
  } = options;
  if (dryRun) return '';
  const result = spawnSync(binary, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });
  if (result.error || result.status !== 0) {
    if (allowFailure) return '';
    if (result.error?.code === 'ETIMEDOUT') {
      throw new Error(`${binary} timed out after ${timeoutMs / 1000} seconds.`);
    }
    const details =
      result.error?.message || result.stderr?.trim().split(/\r?\n/).filter(Boolean).at(-1);
    throw new Error(`${binary} failed${details ? `: ${details}` : ''}`);
  }
  return result.stdout.trim();
}

function requirePath(path, message) {
  if (!existsSync(path)) throw new Error(message);
}

function checkAppleProject(target) {
  requirePath(
    join(ROOT, target.workspace),
    `${target.label} native project is missing at ${target.workspace}. Generate it with ${target.prebuild}, then rerun this command.`,
  );
}

function simulatorDevices() {
  const output = capture('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  if (!output) return [];
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error('Could not parse the available Apple simulator list.');
  }
  return Object.entries(parsed.devices || {}).flatMap(([runtime, devices]) =>
    devices.map((device) => ({ ...device, runtime })),
  );
}

function findSimulator(target) {
  const runtimeName = target.platform === 'tvOS Simulator' ? 'tvOS' : 'iOS';
  const matches = simulatorDevices().filter(
    (candidate) =>
      candidate.name === target.simulatorName &&
      candidate.runtime.includes(runtimeName) &&
      candidate.isAvailable !== false,
  );
  if (matches.length === 0) {
    throw new Error(
      `Apple simulator “${target.simulatorName}” is not installed. Install the matching runtime or update .xcodebuildmcp/config.yaml and the runner together.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `More than one ${runtimeName} simulator is named “${target.simulatorName}”: ${matches
        .map((device) => device.udid)
        .join(', ')}. Rename or remove the duplicate before rerunning.`,
    );
  }
  return matches[0];
}

function bootSimulator(device) {
  if (dryRun) {
    printCommand('xcrun', ['simctl', 'boot', device.udid || device.name]);
    printCommand('xcrun', ['simctl', 'bootstatus', device.udid || device.name, '-b']);
    printCommand('open', ['-a', 'Simulator']);
    return;
  }
  const state = capture('xcrun', ['simctl', 'getenv', device.udid, 'SIMULATOR_DEVICE_NAME'], {
    allowFailure: true,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  // `getenv` succeeds only for a booted device. The boot command itself is
  // idempotent enough for the remaining state and has a useful error message.
  if (!state) {
    run('xcrun', ['simctl', 'boot', device.udid], {
      allowFailure: true,
      timeoutMs: PROBE_TIMEOUT_MS,
    });
  }
  run('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], {
    timeoutMs: SIMULATOR_BOOT_TIMEOUT_MS,
  });
  run('open', ['-a', 'Simulator'], { timeoutMs: PROBE_TIMEOUT_MS });
}

function findBuiltApp(derivedData, productDirectory) {
  const root = join(derivedData, 'Build', 'Products', productDirectory);
  if (!existsSync(root)) return null;
  const entries = readdirSync(root, { withFileTypes: true });
  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  return app ? join(root, app.name) : null;
}

function runApple(targetName) {
  const target = APPLE_TARGETS[targetName];
  checkAppleProject(target);
  const device = dryRun
    ? { name: target.simulatorName, udid: null }
    : findSimulator(target);
  console.log(`\n${target.label}: ${target.simulatorName}${device.udid ? ` (${device.udid})` : ''}`);
  bootSimulator(device);

  const buildArgs = [
    '-workspace',
    join(ROOT, target.workspace),
    '-scheme',
    target.scheme,
    '-configuration',
    target.configuration,
    '-sdk',
    target.sdk,
    '-destination',
    device.udid ? `id=${device.udid}` : `platform=${target.platform},name=${target.simulatorName}`,
    '-derivedDataPath',
    target.derivedData,
    `ARCHS=${target.arch}`,
    'CODE_SIGNING_ALLOWED=NO',
    'ONLY_ACTIVE_ARCH=YES',
    'build',
  ];
  const productDirectory =
    targetName === 'phone' ? 'Release-iphonesimulator' : 'Release-appletvsimulator';
  run('xcodebuild', buildArgs, { timeoutMs: COMMAND_TIMEOUT_MS });
  if (dryRun) {
    const dryRunAppPath = join(
      target.derivedData,
      'Build',
      'Products',
      productDirectory,
      'Huddle.app',
    );
    const simulator = device.udid || target.simulatorName;
    printCommand('xcrun', ['simctl', 'install', simulator, dryRunAppPath]);
    printCommand('xcrun', ['simctl', 'launch', simulator, target.bundleId]);
    return;
  }

  const appPath = findBuiltApp(target.derivedData, productDirectory);
  if (!appPath) {
    throw new Error(
      `${target.label} build completed but no app artifact was found under ${relative(join(target.derivedData, 'Build', 'Products', productDirectory))}.`,
    );
  }
  run('xcrun', ['simctl', 'install', device.udid, appPath], { timeoutMs: PROBE_TIMEOUT_MS });
  run('xcrun', ['simctl', 'launch', device.udid, target.bundleId], {
    timeoutMs: PROBE_TIMEOUT_MS,
  });
}

function checkAndroidTools() {
  requirePath(
    ANDROID.adb,
    `Android SDK adb is missing at ${ANDROID.adb}. Set ANDROID_HOME or ANDROID_SDK_ROOT to the installed SDK.`,
  );
  requirePath(
    ANDROID.emulator,
    `Android emulator is missing at ${ANDROID.emulator}. Set ANDROID_HOME or ANDROID_SDK_ROOT to the installed SDK.`,
  );
  requirePath(
    ANDROID.gradle,
    `Android TV native project is missing at ${relative(ANDROID.gradle)}. Generate it with pnpm --filter @huddle/tv prebuild --platform android --no-install, then rerun this command.`,
  );
}

function androidState() {
  return capture(ANDROID.adb, ['-s', ANDROID_SERIAL, 'get-state'], {
    allowFailure: true,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function waitForAndroidDevice() {
  if (dryRun) {
    printCommand(ANDROID.adb, ['-s', ANDROID_SERIAL, 'wait-for-device']);
    return;
  }
  const deadline = Date.now() + ANDROID_DEVICE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (androidState() === 'device') return;
    sleep(1000);
  }
  throw new Error(
    `Android TV emulator ${ANDROID_SERIAL} did not become available within ${ANDROID_DEVICE_TIMEOUT_MS / 1000} seconds. Keep the huddle_tv emulator open and rerun pnpm sim:tv.`,
  );
}

function androidAvdName() {
  const property = capture(
    ANDROID.adb,
    ['-s', ANDROID_SERIAL, 'shell', 'getprop', 'ro.boot.qemu.avd_name'],
    { allowFailure: true, timeoutMs: PROBE_TIMEOUT_MS },
  );
  if (property) return property.trim();

  const consoleResult = capture(ANDROID.adb, ['-s', ANDROID_SERIAL, 'emu', 'avd', 'name'], {
    allowFailure: true,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  const line = consoleResult
    .split(/\r?\n/)
    .map((value) => value.trim().replace(/^AVD name:\s*/i, ''))
    .find(
      (value) =>
        value && value.toUpperCase() !== 'OK' && !value.startsWith('Android Console'),
    );
  return line || '';
}

function assertAndroidTvTarget() {
  const avdName = androidAvdName();
  if (!avdName) {
    throw new Error(
      `Cannot verify ${ANDROID_SERIAL} is the huddle_tv emulator. Refusing to install the TV app on an unverified target.`,
    );
  }
  if (avdName !== ANDROID_AVD) {
    throw new Error(
      `ADB target ${ANDROID_SERIAL} is attached to AVD “${avdName}”, not “${ANDROID_AVD}”. Close it and rerun pnpm sim:tv.`,
    );
  }
}

function ensureAndroidTv() {
  checkAndroidTools();
  const avds = (dryRun ? ANDROID_AVD : capture(ANDROID.emulator, ['-list-avds']))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!dryRun && !avds.includes(ANDROID_AVD)) {
    throw new Error(
      `Android TV AVD “${ANDROID_AVD}” is not installed. Create it in Android Device Manager before running the TV command.`,
    );
  }

  const initialState = androidState();
  if (initialState !== 'device' && initialState !== 'offline') {
    console.log(`Starting Android TV AVD ${ANDROID_AVD} on ${ANDROID_SERIAL}...`);
    if (!dryRun) {
      const child = spawn(
        ANDROID.emulator,
        ['-avd', ANDROID_AVD, '-port', '5554', '-no-snapshot'],
        { cwd: ROOT, detached: true, stdio: 'ignore' },
      );
      child.unref();
    } else {
      printCommand(ANDROID.emulator, ['-avd', ANDROID_AVD, '-port', '5554', '-no-snapshot']);
    }
  }
  waitForAndroidDevice();
  if (!dryRun) assertAndroidTvTarget();
  if (!dryRun) {
    const deadline = Date.now() + ANDROID_DEVICE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const booted = capture(ANDROID.adb, ['-s', ANDROID_SERIAL, 'shell', 'getprop', 'sys.boot_completed'], {
        allowFailure: true,
        timeoutMs: PROBE_TIMEOUT_MS,
      });
      if (booted === '1') return;
      sleep(1000);
    }
    throw new Error(
      `Android TV emulator ${ANDROID_SERIAL} did not finish booting within ${ANDROID_DEVICE_TIMEOUT_MS / 1000} seconds. Keep the huddle_tv emulator open and rerun pnpm sim:tv.`,
    );
  }
}

function runAndroidTv() {
  ensureAndroidTv();
  console.log(`\nAndroid TV: ${ANDROID_AVD} (${ANDROID_SERIAL})`);
  run(
    ANDROID.gradle,
    ['-p', join(ROOT, 'apps/tv/android'), 'assembleRelease', '-PreactNativeArchitectures=x86_64'],
    { timeoutMs: COMMAND_TIMEOUT_MS },
  );
  if (dryRun) {
    printCommand(ANDROID.adb, ['-s', ANDROID_SERIAL, 'install', '-r', ANDROID.apk]);
    printCommand(ANDROID.adb, ['-s', ANDROID_SERIAL, 'shell', 'am', 'force-stop', TV_BUNDLE_ID]);
    printCommand(ANDROID.adb, [
      '-s',
      ANDROID_SERIAL,
      'shell',
      'monkey',
      '-p',
      TV_BUNDLE_ID,
      '-c',
      'android.intent.category.LEANBACK_LAUNCHER',
      '1',
    ]);
    return;
  }
  requirePath(
    ANDROID.apk,
    `Android TV build completed but the release APK is missing at ${relative(ANDROID.apk)}.`,
  );
  // Every adb call includes the emulator serial. This prevents accidental use
  // of a connected physical TV or another developer device.
  run(ANDROID.adb, ['-s', ANDROID_SERIAL, 'install', '-r', ANDROID.apk], {
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  run(ANDROID.adb, ['-s', ANDROID_SERIAL, 'shell', 'am', 'force-stop', TV_BUNDLE_ID], {
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  run(ANDROID.adb, [
    '-s',
    ANDROID_SERIAL,
    'shell',
    'monkey',
    '-p',
    TV_BUNDLE_ID,
    '-c',
    'android.intent.category.LEANBACK_LAUNCHER',
    '1',
  ], { timeoutMs: PROBE_TIMEOUT_MS });
}

function status() {
  console.log('Huddle simulator status (read-only)');
  for (const [name, target] of Object.entries(APPLE_TARGETS)) {
    const project = existsSync(join(ROOT, target.workspace));
    let simulator = 'unavailable';
    if (project) {
      try {
        const found = findSimulator(target);
        simulator = `${found.name} (${found.udid}) — ${found.state}`;
      } catch (error) {
        simulator = error.message;
      }
    }
    console.log(`${name}: native=${project ? 'ready' : `missing (${target.prebuild})`}; simulator=${simulator}`);
  }
  const avdReady = existsSync(ANDROID.emulator) && !dryRun;
  const avdList = avdReady ? capture(ANDROID.emulator, ['-list-avds'], { allowFailure: true }) : '';
  const hasAvd = avdList.split(/\r?\n/).includes(ANDROID_AVD);
  const androidTargetState = androidState() || 'offline';
  const androidTargetAvd = androidTargetState === 'device' ? androidAvdName() || 'unverified' : '—';
  console.log(
    `tv: native=${existsSync(ANDROID.gradle) ? 'ready' : 'missing (run pnpm --filter @huddle/tv prebuild --platform android --no-install)'}; AVD=${hasAvd ? ANDROID_AVD : 'missing'}; target=${ANDROID_SERIAL}; state=${androidTargetState}; verifiedAVD=${androidTargetAvd}`,
  );
  console.log(`tv APK: ${existsSync(ANDROID.apk) ? relative(ANDROID.apk) : 'not built'}`);
}

function main() {
  if (!['status', 'phone', 'tv', 'tvos', 'all'].includes(command)) {
    throw new Error('Usage: pnpm sim:status|sim:phone|sim:tv|sim:tvos|sim:all [--dry-run]');
  }
  if (command === 'status') return status();
  if (command === 'phone') return runApple('phone');
  if (command === 'tvos') return runApple('tvos');
  if (command === 'tv') return runAndroidTv();
  runApple('phone');
  runAndroidTv();
}

try {
  main();
} catch (error) {
  console.error(`\nSimulator workflow stopped: ${error.message}`);
  process.exitCode = 1;
}
