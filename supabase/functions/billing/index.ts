import {createBillingHandler} from '../_shared/billing-core.mjs';
import {getRuntime} from '../_shared/billing-runtime.mjs';

// Custom authorization verifies the user's session and current company role.
Deno.serve(createBillingHandler(getRuntime));
