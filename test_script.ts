import { POST } from './packages/web-app-vercel/app/api/playlists/bulk_update/route';
import { requireAuth } from './packages/web-app-vercel/lib/api-auth';
import * as supabaseLocal from './packages/web-app-vercel/lib/supabaseLocal';

jest.mock('./packages/web-app-vercel/lib/api-auth');
jest.mock('./packages/web-app-vercel/lib/supabaseLocal');
// ... this is too complex to run outside Jest. Let's modify the route to see why it fails.
