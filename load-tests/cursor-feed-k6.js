import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Ramp-up
    { duration: '30s', target: 20 },  // Steady load
    { duration: '10s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of requests must complete below 100ms
    http_req_failed: ['rate<0.01'],    // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const TEAM_ID = __ENV.BENCHMARK_TEAM_ID || 'f5aefa67-ceaa-4f88-88d8-b98fb6baa7ea';
const AUTH_TOKEN = __ENV.BENCHMARK_AUTH_TOKEN || '';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
  };

  // 1. Fetch initial page
  let res = http.get(`${BASE_URL}/api/teams/${TEAM_ID}/activity?limit=20`, params);
  check(res, {
    'initial page status is 200': (r) => r.status === 200,
    'has items': (r) => JSON.parse(r.body).items.length > 0,
  });

  const body = JSON.parse(res.body);
  let cursor = body.nextCursor;

  // 2. Fetch subsequent pages using cursor
  let pageCount = 0;
  while (cursor && pageCount < 3) {
    pageCount++;
    res = http.get(
      `${BASE_URL}/api/teams/${TEAM_ID}/activity?limit=20&cursor=${encodeURIComponent(cursor)}`,
      params
    );
    check(res, {
      'cursor page status is 200': (r) => r.status === 200,
    });
    const nextPage = JSON.parse(res.body);
    cursor = nextPage.nextCursor;
    sleep(0.5);
  }

  sleep(1);
}
