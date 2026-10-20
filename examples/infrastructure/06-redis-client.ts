import { header, section, requireEnv } from '../_shared/setup.js';
import { createRedisClient, createConfigFromEnv, type RedisClient } from '@cogitator-ai/redis';

async function main() {
  header('06 — Redis Client: Unified Standalone & Cluster Client');

  const redisUrl = requireEnv('REDIS_URL');

  let client: RedisClient | null = null;
  let subscriber: RedisClient | null = null;

  try {
    section('1. Configuration & Client Creation');

    // Create Redis configuration from environment variables
    const envConfig = createConfigFromEnv();
    console.log('Redis configuration loaded from environment:');
    console.log(`  Mode:              ${envConfig.mode}`);
    console.log(`  URL:               ${'url' in envConfig ? envConfig.url : 'n/a'}`);
    console.log(`  Default keyPrefix: ${envConfig.keyPrefix}`);

    // Create primary client with explicit keyPrefix for namespacing
    client = await createRedisClient({
      ...envConfig,
      keyPrefix: 'demo:',
    });
    console.log('Connected primary Redis client with keyPrefix "demo:".');

    // Create a second client for pub/sub subscriptions
    subscriber = await createRedisClient({
      url: redisUrl,
    });
    console.log('Connected secondary Redis client for subscriptions.');

    section('2. Key-Value Operations & Key Prefixing');

    // Set several keys using primary client
    await client.set('app:name', 'Cogitator AI');
    await client.set('app:version', '1.0.0');
    await client.set('app:status', 'running');
    console.log('Set 3 keys with client (prefixed under "demo:"):');
    console.log('  app:name    -> "Cogitator AI"');
    console.log('  app:version -> "1.0.0"');
    console.log('  app:status  -> "running"');

    // Read several keys back
    const name = await client.get('app:name');
    const [version, status] = await client.mget('app:version', 'app:status');
    console.log('\nRead keys using client:');
    console.log(`  client.get('app:name') = "${name}"`);
    console.log(`  client.mget('app:version', 'app:status') = ["${version}", "${status}"]`);

    // Verify keyPrefix behavior:
    // client.keys('app:*') searches within 'demo:' and returns relative keys
    const relativeKeys = await client.keys('app:*');
    console.log('\nPrefix-relative keys (client.keys("app:*")):');
    console.log(' ', relativeKeys.sort());

    // Check with the un-prefixed subscriber client to see the raw key stored in Redis
    const rawValue = await subscriber.get('demo:app:name');
    console.log(`Raw key in Redis storage (subscriber.get("demo:app:name")): "${rawValue}"`);

    section('3. Key Expiration with TTL');

    // Set a key with 1-second TTL
    await client.set('temp:session', 'ephemeral-session-token');
    await client.expire('temp:session', 1);
    const immediateValue = await client.get('temp:session');
    console.log(`Immediate value before TTL expiration: "${immediateValue}"`);

    console.log('Waiting 1.2s for TTL expiration...');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const expiredValue = await client.get('temp:session');
    console.log(`Value after TTL expiration: ${expiredValue} (null means expired)`);

    section('4. Atomic Counters with incr');

    const c1 = await client.incr('stats:visits');
    const c2 = await client.incr('stats:visits');
    const c3 = await client.incr('stats:visits');
    console.log(`Counter incremented sequentially: ${c1} -> ${c2} -> ${c3}`);

    section('5. Pub/Sub Messaging Between Two Clients');

    const channel = 'system:events';

    // Set up a promise to wait for message delivery
    let resolveMessage: (msg: string) => void;
    const messagePromise = new Promise<string>((resolve) => {
      resolveMessage = resolve;
    });

    // Subscribe using the subscriber client
    await subscriber.subscribe(channel, (ch, message) => {
      console.log(`  [Subscriber] Received message on channel "${ch}": ${message}`);
      resolveMessage(message);
    });
    console.log(`  [Subscriber] Subscribed to "${channel}".`);

    // Publish using the primary client
    const eventPayload = JSON.stringify({ event: 'ping', timestamp: Date.now() });
    console.log(`  [Publisher]  Publishing message: ${eventPayload}`);
    const receiverCount = await client.publish(channel, eventPayload);
    console.log(`  [Publisher]  Message received by ${receiverCount} subscriber(s).`);

    // Wait for message receipt
    const received = await messagePromise;
    console.log(`  [Subscriber] Verified message payload: ${received}`);

    // Unsubscribe from channel
    await subscriber.unsubscribe(channel);
    console.log(`  [Subscriber] Unsubscribed from "${channel}".`);

    // Clean up temporary keys
    await client.del('app:name', 'app:version', 'app:status', 'stats:visits');
    console.log('\nCleaned up demo keys.');
  } finally {
    // Ensure all clients and subscription resources are cleanly closed
    if (subscriber) {
      try {
        await subscriber.unsubscribe('system:events');
      } catch {
        // ignore error during cleanup
      }
      try {
        await subscriber.quit();
      } catch {
        // ignore error during cleanup
      }
    }
    if (client) {
      try {
        await client.quit();
      } catch {
        // ignore error during cleanup
      }
    }
    console.log('\nAll Redis clients closed cleanly.');
  }

  console.log('\nDone.');
}

main().catch(console.error);
