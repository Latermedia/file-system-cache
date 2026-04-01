import * as fs from 'node:fs';
import { R, Util, hashAlgorithms, type t } from './common/index';

/**
 * A cache that read/writes to a specific part of the file-system.
 */
export class FileSystemCache {
  /**
   * The list of all available hash algorithms.
   */
  static hashAlgorithms: t.HashAlgorithm[] = hashAlgorithms;

  /**
   * Instance.
   */
  readonly basePath: string;
  readonly ns?: any;
  readonly extension?: string;
  readonly hash: t.HashAlgorithm;
  readonly ttl: number;
  basePathExists?: boolean;

  /**
   * Constructor.
   * @param options
   *            - basePath:   The folder path to read/write to.
   *                          Default: './build'
   *            - ns:         A single value, or array, that represents a
   *                          a unique namespace within which values for this
   *                          store are cached.
   *            - extension:  An optional file-extension for paths.
   *            - ttl:        The default time-to-live for cached values in seconds.
   *                          Default: 0 (never expires)
   *            - hash:       The hashing algorithm to use when generating cache keys.
   *                          Default: "sha1"
   */
  constructor(options: t.FileSystemCacheOptions = {}) {
    this.basePath = formatPath(options.basePath);
    this.hash = options.hash ?? 'sha1';
    this.ns = Util.hash(this.hash, options.ns);
    this.ttl = options.ttl ?? 0;
    if (Util.isString(options.extension)) this.extension = options.extension;

    if (Util.isFileSync(this.basePath)) {
      throw new Error(`The basePath '${this.basePath}' is a file. It should be a folder.`);
    }

    if (!Util.hashExists(this.hash)) {
      throw new Error(`Hash does not exist: ${this.hash}`);
    }
  }

  /**
   * Generates the path to the cached files.
   * @param {string} key: The key of the cache item.
   */
  public path(key: string): string {
    if (Util.isNothing(key)) throw new Error(`Path requires a cache key.`);
    let name = Util.hash(this.hash, key);
    if (this.ns) name = `${this.ns}-${name}`;
    if (this.extension) name = `${name}.${this.extension.replace(/^\./, '')}`;
    return `${this.basePath}/${name}`;
  }

  /**
   * Determines whether the file exists.
   * @param {string} key: The key of the cache item.
   */
  public fileExists(key: string) {
    return Util.pathExists(this.path(key));
  }

  /**
   * Ensure that the base path exists.
   */
  public async ensureBasePath() {
    if (!this.basePathExists) await Util.ensureDir(this.basePath);
    this.basePathExists = true;
  }

  /**
   * Gets the contents of the file with the given key.
   * @param {string} key: The key of the cache item.
   * @param defaultValue: Optional. A default value to return if the value does not exist in cache.
   * @return File contents, or
   *         undefined if the file does not exist.
   */
  public async get<T = any>(key: string, defaultValue?: T | (() => T) | (() => Promise<T>)): Promise<T | undefined>  {
    return Util.getValueP(this.path(key), defaultValue);
  }

  /**
   * Gets the contents of the file with the given key.
   * @param {string} key: The key of the cache item.
   * @param defaultValue: Optional. A default value to return if the value does not exist in cache.
   * @return the cached value, or undefined.
   */
  public getSync<T = any>(key: string, defaultValue?: T): T | undefined {
    const value = Util.storedValue(this.path(key));
    const valueExpired = value && Util.isExpired(value);

    if (value && !valueExpired) {
      return Util.toGetValue(value);
    }

    if (valueExpired) {
      Util.removeSync(this.path(key));
    }

    if (typeof defaultValue === 'function') {
      return (defaultValue as Function)();
    }
    return defaultValue;
  }

  /**
   * Writes the given value to the file-system.
   * @param {string} key: The key of the cache item.
   * @param value: The value to write (Primitive or Object).
   */
  public async set<T = any>(key: string, value: T | (() => T) | (() => Promise<T>), ttl?: number) {
    const path = this.path(key);
    ttl = typeof ttl === 'number' ? ttl : this.ttl;
    await this.ensureBasePath();
    let valueToWrite;
    if (typeof value === 'function') {
      const result = (value as Function)();
      valueToWrite = result instanceof Promise ? await result : result;
    } else {
      valueToWrite = value;
    }
    await Util.outputFile(path, Util.toJson(valueToWrite, ttl));
    return { path };
  }

  /**
   * Writes the given value to the file-system and memory cache.
   * @param {string} key: The key of the cache item.
   * @param value: The value to write (Primitive or Object).
   * @return the cache.
   */
  public setSync<T = any>(key: string, value: T | (() => T), ttl?: number) {
    ttl = typeof ttl === 'number' ? ttl : this.ttl;
    let valueToWrite;
    if (typeof value === 'function') {
      valueToWrite = (value as Function)();
    } else {
      valueToWrite = value;
    }
    Util.outputFileSync(this.path(key), Util.toJson(valueToWrite, ttl));
    return this;
  }

  /**
   * Returns the cached value or sets the default value and returns it.
   * @param {string} key: The key of the cache item.
   * @param defaultValue: The value to write (Primitive, Object, or function).
   * @return the cached value or the default value.
   */
  public async fetch<T = any>(key: string, defaultValue: T | (() => T) | (() => Promise<T>), ttl?: number): Promise<T | undefined>  {
    let value = await this.get(key);
    
    // return cached value
    if (value !== undefined) {
      return value;
    }

    if (typeof defaultValue === 'function') {
      const result = (defaultValue as Function)();
      value = result instanceof Promise ? await result : result;
    } else {
      value = defaultValue;
    }

    // save value to cache
    await this.set(key, value, ttl);

    return value;
  }

  /**
   * Returns the cached value or sets the default value and returns it.
   * @param {string} key: The key of the cache item.
   * @param defaultValue: The value to write (Primitive, Object, or function).
   * @return the cached value or the default value.
   */
  public fetchSync<T = any>(key: string, defaultValue: T | (() => T), ttl?: number): T | undefined  {
    let value = this.getSync(key);
    
    // return cached value
    if (value !== undefined) {
      return value;
    }

    if (typeof defaultValue === 'function') {
      value = (defaultValue as Function)();
    } else {
      value = defaultValue;
    }

    // save value to cache
    this.setSync(key, value, ttl);

    return value;
  }

  /**
   * Removes the item from the file-system.
   * @param {string} key: The key of the cache item.
   */
  public remove(key: string) {
    return Util.remove(this.path(key));
  }

  /**
   * Removes all items from the cache.
   */
  public async clear() {
    const paths = await Util.filePathsP(this.basePath, this.ns);
    await Promise.all(paths.map((path) => Util.remove(path)));
    console.groupEnd();
  }

  /**
   * Saves several items to the cache in one operation.
   * @param {array} input: An array of objects of the form { key, value }.
   */
  public async save(input: ({ key: string; value: any } | null | undefined)[]): Promise<{ paths: string[] }> {
    type Item = { key: string; value: any };
    let items = (Array.isArray(input) ? input : [input]) as Item[];

    const isValid = (item: any) => {
      if (!R.is(Object, item)) return false;
      return item.key && item.value;
    };

    items = items.filter((item) => Boolean(item));
    items
      .filter((item) => !isValid(item))
      .forEach(() => {
        const err = `Save items not valid, must be an array of {key, value} objects.`;
        throw new Error(err);
      });

    if (items.length === 0) return { paths: [] };

    const paths = await Promise.all(items.map(async (item) => (await this.set(item.key, item.value)).path));

    return { paths };
  }

  /**
   * Loads all files within the cache's namespace.
   */
  public async load(): Promise<{ files: { path: string; value: any }[] }> {
    const paths = await Util.filePathsP(this.basePath, this.ns);
    if (paths.length === 0) return { files: [] };
    const files = await Promise.all(paths.map(async (path) => ({ path, value: await Util.getValueP(path) })));
    return { files };
  }

  /**
   * Optimizes the cache by removing all files that are older than the given time-to-live.
   */
  public async optimize() {
    const paths = await Util.filePathsP(this.basePath, this.ns);
    await Promise.all(paths.map((path) => {
      const value = Util.storedValue(path);
      if (value && Util.isExpired(value)) {
        return Util.remove(path);
      }
    }));
  }
}

/**
 * Helpers
 */

function formatPath(path?: string) {
  path = Util.ensureString('./.cache', path);
  path = Util.toAbsolutePath(path);
  return path;
}
