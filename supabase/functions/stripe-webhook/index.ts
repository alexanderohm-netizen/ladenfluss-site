import {createWebhookHandler} from '../_shared/billing-core.mjs';
import {getRuntime} from '../_shared/billing-runtime.mjs';

// Every event is authenticated with Stripe's signature before any data changes.
Deno.serve(createWebhookHandler(getRuntime));
