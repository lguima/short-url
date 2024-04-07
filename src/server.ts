import fastify from 'fastify';
import postgres from 'postgres';
import { z } from 'zod';

import { sql } from './lib/postgres';
import { redis } from './lib/redis';

const app = fastify();

app.get('/:code', async (request, reply) => {
  const codeSchema = z.object({
    code: z.string().min(3),
  });

  const { code } = codeSchema.parse(request.params);

  const shortUrl = await sql`
    SELECT id, original_url
    FROM short_url
    WHERE short_url.code = ${code}
  `;

  if (shortUrl.length === 0) {
    reply.status(404).send({
      message: 'Not found.',
    });
  }

  const url = shortUrl[0];

  await redis.zIncrBy('redirect', 1, url.id.toString());

  return reply.redirect(301, url.original_url);
});

app.get('/urls', () => {
  const urls = sql`
    SELECT *
    FROM short_url
    ORDER BY created_at DESC
  `;

  return urls;
});

app.post('/urls', async (request, reply) => {
  const urlSchema = z.object({
    code: z.string().min(3),
    url: z.string().url(),
  });

  const { code, url } = urlSchema.parse(request.body);

  try {
    const insert = await sql`
      INSERT INTO short_url (code, original_url)
      VALUES (${code}, ${url})
      RETURNING id
    `

    const shortUrl = insert[0];

    return reply.status(201).send({
      shortUrl: {
        id: shortUrl.id
      }
    });
  } catch (err) {
    if (err instanceof postgres.PostgresError) {
      if (err.code === '23505') {
        return reply.status(409).send({
          message: 'Duplicate code'
        });
      }
    }

    console.error(err);

    return reply.status(500).send({
      message: 'Unexpected error'
    });
  }
});

app.get('/metrics/redirects', async () => {
  const redirects = await redis.zRangeByScoreWithScores('redirect', 0, 50);

  const sorted = redirects.sort((a, b) => b.score - a.score).map(item => ({
    shortUrl: {
      id: Number(item.value),
    },
    redirects: item.score,
  }));

  return sorted;
});

app.listen({
  port: 3333,
}).then(() => console.log('Server running.'));
