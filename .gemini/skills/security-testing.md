# 🔒 TechZone — Security & Testing Skill

## Security Architecture

### Client-Side
- `lib/clientBundleSecurity.js` — Vite plugin scans bundle for leaked secrets
- `lib/requiredPublicEnv.js` — Validates env vars exist at build time
- Build FAILS if `SUPABASE_SERVICE_ROLE_KEY` appears in client bundle

### Server-Side
- `functions/_middleware.js` — Hides admin panel from direct access
- `functions/_lib/adminShellGate.js` — Admin authentication gate
- `functions/_lib/rateLimit.js` — IP-based rate limiting
- `functions/_lib/securityHeaders.js` — Standard security headers
- `lib/adminRoles.js` — Role-based access control

### Post-Deploy Verification
- `lib/postdeploySecurityAssessment.mjs` — Automated security checks
- `lib/postdeploySecurityConfig.mjs` — Check configuration
- `lib/postdeploySecurityRunner.mjs` — Test runner

## Testing Framework

### Stack
- **Node.js built-in** `node:test` + `node:assert/strict`
- No Jest, no Mocha — use only Node.js native test runner
- Test files: `*.test.mjs` (ESM)

### Running Tests
```bash
npm test  # Runs ALL test files listed in package.json
```

### Test File Convention
```
lib/featureModel.test.mjs          → Unit tests for lib/featureModel.js
services/featureService.test.mjs   → Unit tests for services/featureService.js
functions/api/feature.test.mjs     → Unit tests for API functions
```

### Test Template
```js
/**
 * featureModel tests.
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('functionName', () => {
  it('should_do_expected_behavior_when_condition', () => {
    const result = functionUnderTest(input);
    assert.equal(result, expected);
  });

  it('should_throw_when_invalid_input', () => {
    assert.throws(() => functionUnderTest(null), { message: /expected/ });
  });
});
```

### Mocking Pattern
```js
import { mock } from 'node:test';

// Mock a module
const mockSupabase = {
  from: mock.fn(() => ({
    select: mock.fn(() => ({
      eq: mock.fn(() => ({
        single: mock.fn(() => Promise.resolve({
          data: { id: '1', name: 'Test' },
          error: null,
        })),
      })),
    })),
  })),
};
```

## Error Handling Convention

### Error Codes
Format: `[DOMAIN-CODE]` where CODE is an HTTP-like status:
- `[DOMAIN-400]` — Bad request / validation error
- `[DOMAIN-401]` — Unauthorized
- `[DOMAIN-403]` — Forbidden
- `[DOMAIN-404]` — Not found
- `[DOMAIN-409]` — Conflict (e.g., stock)
- `[DOMAIN-500]` — Internal error

### API Error Response
```js
return new Response(JSON.stringify({
  error: 'وصف الخطأ بالعربي',
  code: 'CHECKOUT_STOCK_INSUFFICIENT',
}), {
  status: 409,
  headers: { 'Content-Type': 'application/json' },
});
```

### Client Error Handling
```js
try {
  const result = await fetchData();
} catch (error) {
  console.error('[DOMAIN-500]', error.message);
  setError('حدث خطأ غير متوقع. حاول مرة أخرى.');
}
```

## Input Validation Rules
- Validate ALL inputs in both client models AND server functions
- Use dedicated validation functions in `lib/*Model.js`
- Return `{ valid: boolean, errors: string[] }` format
- All error messages in Arabic for user-facing, English for logs
