import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../server.js';

describe('GET /health', () => {
  it('returns 200 status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('returns {"status":"ok"} body', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns Content-Type application/json', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/nonexistent')
      .set('Authorization', 'Bearer mock-token');
    expect(response.status).toBe(404);
  });
});
