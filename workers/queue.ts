import IORedis from 'ioredis';
import RedisMock from 'ioredis-mock';
let client: IORedis | any;
export async function getRedis(): Promise<IORedis> {
  if (client) return client as any;
  const url = process.env.REDIS_URL;
  if (!url) { client = new (RedisMock as any)(); return client as any; }
  client = new IORedis(url);
  return client as any;
}
export async function getRedisPubSub() {
  const main = await getRedis();
  const pub = main.duplicate(); const sub = main.duplicate();
  await (pub as any).connect?.(); await (sub as any).connect?.();
  return { pub, sub, subOnly: sub };
}
