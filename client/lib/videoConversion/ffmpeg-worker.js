/**
 * FFmpeg.wasm ESM Worker - Bundled version
 *
 * This is a self-contained bundle of @ffmpeg/ffmpeg worker.js with its dependencies
 * (const.js, errors.js) inlined to work as a blob URL without relative imports.
 *
 * Source: @ffmpeg/ffmpeg@0.12.10/dist/esm/
 * Created for Metro bundler compatibility (avoids import.meta issues)
 */

// ============================================================================
// Inlined from const.js
// ============================================================================
const MIME_TYPE_JAVASCRIPT = "text/javascript";
const MIME_TYPE_WASM = "application/wasm";
const CORE_VERSION = "0.12.6";
const CORE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

const FFMessageType = {
  LOAD: "LOAD",
  EXEC: "EXEC",
  WRITE_FILE: "WRITE_FILE",
  READ_FILE: "READ_FILE",
  DELETE_FILE: "DELETE_FILE",
  RENAME: "RENAME",
  CREATE_DIR: "CREATE_DIR",
  LIST_DIR: "LIST_DIR",
  DELETE_DIR: "DELETE_DIR",
  ERROR: "ERROR",
  DOWNLOAD: "DOWNLOAD",
  PROGRESS: "PROGRESS",
  LOG: "LOG",
  MOUNT: "MOUNT",
  UNMOUNT: "UNMOUNT",
};

// ============================================================================
// Inlined from errors.js
// ============================================================================
const ERROR_UNKNOWN_MESSAGE_TYPE = new Error("unknown message type");
const ERROR_NOT_LOADED = new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
const ERROR_TERMINATED = new Error("called FFmpeg.terminate()");
const ERROR_IMPORT_FAILURE = new Error("failed to import ffmpeg-core.js");

// ============================================================================
// Worker implementation (from worker.js)
// ============================================================================
let ffmpeg;

const load = async ({ coreURL: _coreURL, wasmURL: _wasmURL, workerURL: _workerURL }) => {
  const first = !ffmpeg;
  try {
    if (!_coreURL) _coreURL = CORE_URL;
    // Use importScripts for classic worker context
    importScripts(_coreURL);
  } catch {
    if (!_coreURL || _coreURL === CORE_URL) {
      _coreURL = CORE_URL.replace("/umd/", "/esm/");
    }
    // For module context, use dynamic import
    self.createFFmpegCore = (await import(_coreURL)).default;
    if (!self.createFFmpegCore) {
      throw ERROR_IMPORT_FAILURE;
    }
  }
  const coreURL = _coreURL;
  const wasmURL = _wasmURL || _coreURL.replace(/.js$/g, ".wasm");
  const workerURL = _workerURL || _coreURL.replace(/.js$/g, ".worker.js");
  ffmpeg = await self.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL }))}`,
  });
  ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
  ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));
  return first;
};

const exec = ({ args, timeout = -1 }) => {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
};

const writeFile = ({ path, data }) => {
  ffmpeg.FS.writeFile(path, data);
  return true;
};

const readFile = ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding });

const deleteFile = ({ path }) => {
  ffmpeg.FS.unlink(path);
  return true;
};

const rename = ({ oldPath, newPath }) => {
  ffmpeg.FS.rename(oldPath, newPath);
  return true;
};

const createDir = ({ path }) => {
  ffmpeg.FS.mkdir(path);
  return true;
};

const listDir = ({ path }) => {
  const names = ffmpeg.FS.readdir(path);
  const entries = [];
  for (const name of names) {
    const stat = ffmpeg.FS.stat(`${path}/${name}`);
    const isDir = ffmpeg.FS.isDir(stat.mode);
    entries.push({ name, isDir });
  }
  return entries;
};

const deleteDir = ({ path }) => {
  ffmpeg.FS.rmdir(path);
  return true;
};

const mount = ({ fsType, options, mountPoint }) => {
  const str = fsType;
  const fs = ffmpeg.FS.filesystems[str];
  if (!fs) return false;
  ffmpeg.FS.mount(fs, options, mountPoint);
  return true;
};

const unmount = ({ mountPoint }) => {
  ffmpeg.FS.unmount(mountPoint);
  return true;
};

self.onmessage = async ({ data: { id, type, data } }) => {
  const trans = [];
  let _data;
  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
    switch (type) {
      case FFMessageType.LOAD:
        _data = await load(data);
        break;
      case FFMessageType.EXEC:
        _data = exec(data);
        break;
      case FFMessageType.WRITE_FILE:
        _data = writeFile(data);
        break;
      case FFMessageType.READ_FILE:
        _data = readFile(data);
        break;
      case FFMessageType.DELETE_FILE:
        _data = deleteFile(data);
        break;
      case FFMessageType.RENAME:
        _data = rename(data);
        break;
      case FFMessageType.CREATE_DIR:
        _data = createDir(data);
        break;
      case FFMessageType.LIST_DIR:
        _data = listDir(data);
        break;
      case FFMessageType.DELETE_DIR:
        _data = deleteDir(data);
        break;
      case FFMessageType.MOUNT:
        _data = mount(data);
        break;
      case FFMessageType.UNMOUNT:
        _data = unmount(data);
        break;
      default:
        throw ERROR_UNKNOWN_MESSAGE_TYPE;
    }
  } catch (e) {
    self.postMessage({ id, type: FFMessageType.ERROR, data: e.toString() });
    return;
  }
  if (_data instanceof Uint8Array) {
    trans.push(_data.buffer);
  }
  self.postMessage({ id, type, data: _data }, trans);
};
