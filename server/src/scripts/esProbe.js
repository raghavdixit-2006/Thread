// scripts/esProbe.js - one-shot dependency probe (dev tooling, not part of the API).
import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: process.env.ELASTIC_NODE || 'http://localhost:9200' });
try {
  const info = await client.info();
  console.log('info meta statusCode:', info.meta?.statusCode);
  console.log('version:', info.body?.version?.number);
} catch (err) {
  console.log('INFO FAILED:', String(err.message).slice(0, 300));
}
try {
  const resp = await client.search({ index: process.env.ELASTIC_INDEX || 'products', size: 1, query: { match_all: {} } });
  console.log('search total:', resp.hits.total?.value);
} catch (err) {
  console.log('SEARCH FAILED:', String(err.message).slice(0, 300));
}
process.exit(0);
