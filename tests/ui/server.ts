import { createWebServer, listen } from '../../src/web/server.ts';
import { owners } from '../helpers.ts';
import { open } from './data.ts';

const url = await listen(createWebServer(open, owners), Number(process.env.PORT ?? 4318));
console.log(`UI test server at ${url}`);
