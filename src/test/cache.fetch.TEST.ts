import { BasePath, FileSystemCache, afterAll, beforeEach, deleteTmpDir, describe, expect, it } from './common';

describe('fetch', () => {
  const basePath = BasePath.random();
  beforeEach(() => deleteTmpDir(basePath));
  afterAll(() => deleteTmpDir(basePath));

  it('return the cached value', async () => {
    const cache = new FileSystemCache({ basePath });
    await cache.set('foo', 'abcd');
    const res2 = await cache.fetch('foo', '123');
    expect(res2).to.eql('abcd');
  });

  describe('sets default value to cache', () => {
    it('static', async () => {
      const cache = new FileSystemCache({ basePath });
      const res = await cache.fetch('foo', '123');
      expect(res).to.eql('123');

      const res2 = await cache.get('foo');
      expect(res2).to.eql('123');
    });

    it('sync function', async () => {
      const cache = new FileSystemCache({ basePath });
      const res = await cache.fetch('foo', () => {
        return { things: 123}
      });
      expect(res).to.eql({ things: 123 });

      const res2 = await cache.get('foo');
      expect(res2).to.eql({ things: 123 });
    });

    it('async function', async () => {
      const cache = new FileSystemCache({ basePath });
      const res = await cache.fetch('foo', async () => {
        return { things: 123}
      });
      expect(res).to.eql({ things: 123 });

      const res2 = await cache.get('foo');
      expect(res2).to.eql({ things: 123});
    });
  });
});

describe('fetchSync', () => {
  const basePath = BasePath.random();
  beforeEach(() => deleteTmpDir(basePath));
  afterAll(() => deleteTmpDir(basePath));

  it('return the cached value', async () => {
    const cache = new FileSystemCache({ basePath });
    await cache.set('foo', 'abcd');
    const res2 = cache.fetchSync('foo', '123');
    expect(res2).to.eql('abcd');
  });

  describe('sets default value to cache', () => {
    it('static', async () => {
      const cache = new FileSystemCache({ basePath });
      const res = cache.fetchSync('foo', '123');
      expect(res).to.eql('123');

      const res2 = await cache.get('foo');
      expect(res2).to.eql('123');
    });

    it('sync function', async () => {
      const cache = new FileSystemCache({ basePath });
      const res = cache.fetchSync('foo', () => {
        return { things: 123}
      });
      expect(res).to.eql({ things: 123 });

      const res2 = await cache.get('foo');
      expect(res2).to.eql({ things: 123 });
    });
  });
});
