// 안드로이드 APK 만들기: npm run apk
// 1) 웹 빌드 → 2) Capacitor로 android/ 에 복사 → 3) 영문 경로(C:/mvtmp/apkbuild)에서 Gradle 빌드 → 4) apk/ 에 복사
// (안드로이드 빌드 도구는 한글이 든 경로에서 빌드하지 않는다. Java도 한글 경로에서 내부 연결이 실패해 임시 폴더를 영문으로 둔다)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const work = 'C:/mvtmp/apkbuild';
const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
const javaHome = process.env.JAVA_HOME || join(local, 'Programs', 'toonw-jdk', 'jdk-21.0.12.1+1');
const androidHome = process.env.ANDROID_HOME || join(local, 'Android', 'Sdk');
if (!existsSync(join(javaHome, 'bin'))) throw new Error(`JDK 21을 찾지 못했습니다: ${javaHome} (JAVA_HOME을 지정해 주세요)`);
if (!existsSync(androidHome)) throw new Error(`Android SDK를 찾지 못했습니다: ${androidHome} (ANDROID_HOME을 지정해 주세요)`);

const run = (cmd, cwd = root, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

run('npm run build');
run('npx cap sync android');

rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'node_modules', '@capacitor'), { recursive: true });
cpSync(join(root, 'android'), join(work, 'android'), { recursive: true, filter: (p) => !/[\\/](build|\.gradle)([\\/]|$)/.test(p.slice(root.length)) });
cpSync(join(root, 'node_modules', '@capacitor', 'android'), join(work, 'node_modules', '@capacitor', 'android'), { recursive: true });

const env = {
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  PATH: `${join(javaHome, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
  JAVA_TOOL_OPTIONS: '-Djdk.net.unixdomain.tmpdir=C:/mvtmp -Djava.io.tmpdir=C:/mvtmp',
};
// 현재 폴더 실행을 막아 둔 환경이 있어 절대 경로로 부른다
const gradlew = join(work, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
run(`"${gradlew}" assembleDebug --no-daemon`, join(work, 'android'), env);

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
mkdirSync(join(root, 'apk'), { recursive: true });
const out = join(root, 'apk', `TOO-multiview-${version}-${sha}-debug.apk`);
cpSync(join(work, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), out);
console.log(`\nAPK: ${out}`);
