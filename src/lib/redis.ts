import { createClient } from 'redis'

export const redis = createClient({
  url: 'redis://:pw00@localhost:6379',
});

redis.connect();
