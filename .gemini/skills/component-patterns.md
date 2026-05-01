# 🧩 TechZone — Component & Code Patterns Skill

## React Component Template

Every new component MUST follow this exact pattern:

```jsx
/**
 * ComponentName — Brief description of what it does.
 *
 * Used in: [where this component is rendered]
 */

import { useState, useEffect } from 'react';
import styles from './ComponentName.module.css';

/** @constant Description of purpose */
const SOME_CONSTANT = 'value';

/**
 * Renders the ComponentName UI.
 *
 * @param {object} props
 * @param {string} props.title - The display title
 * @returns {JSX.Element}
 */
export default function ComponentName({ title }) {
  const [state, setState] = useState(null);

  return (
    <div className={styles.container}>
      <h2>{title}</h2>
    </div>
  );
}
```

## CSS Module Template

```css
/**
 * ComponentName styles.
 *
 * Scoped styles for the ComponentName component.
 * Uses dark theme tokens and physical CSS properties for RTL.
 */

.container {
  /* Use physical properties for RTL */
  padding-right: 1rem;
  padding-left: 1rem;
  background: var(--surface-card, rgba(255, 255, 255, 0.04));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Responsive: mobile-first */
@media (max-width: 768px) {
  .container {
    padding-right: 0.75rem;
    padding-left: 0.75rem;
  }
}
```

## Custom Hook Template

```js
/**
 * useFeatureName — Manages state and side effects for FeatureName.
 *
 * Composes services and models to provide a clean API to components.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchFeatureData } from '@/services/featureService';
import { validateFeatureInput } from '@/lib/featureModel';

/** @constant Loading timeout in milliseconds */
const LOAD_TIMEOUT_MS = 8000;

/**
 * Hook for managing FeatureName state.
 *
 * @param {string} featureId - The feature identifier
 * @returns {{ data: object|null, loading: boolean, error: string|null, refresh: Function }}
 */
export function useFeatureName(featureId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!featureId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeatureData(featureId);
      setData(result);
    } catch (err) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [featureId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
```

## Service Layer Template

```js
/**
 * featureService — Data access layer for Feature domain.
 *
 * All Supabase queries and external API calls for Feature.
 * Returns raw data; business logic belongs in lib/featureModel.js.
 */

import { supabase } from '@/lib/supabaseClient';

/** @constant Maximum items per page */
const PAGE_SIZE = 20;

/**
 * Fetches feature data from Supabase.
 *
 * @param {string} featureId - The feature to load
 * @returns {Promise<object>} The feature record
 * @throws {Error} If the query fails
 */
export async function fetchFeatureData(featureId) {
  const { data, error } = await supabase
    .from('features')
    .select('*')
    .eq('id', featureId)
    .single();

  if (error) {
    throw new Error(`[FEATURE-500] ${error.message}`);
  }

  return data;
}
```

## Model (Business Logic) Template

```js
/**
 * featureModel — Pure business logic for Feature domain.
 *
 * Contains validation, transformation, and computation functions.
 * NO side effects. NO Supabase calls. NO DOM access.
 */

/** @constant Minimum allowed title length */
const MIN_TITLE_LENGTH = 3;

/** @constant Maximum allowed title length */
const MAX_TITLE_LENGTH = 120;

/**
 * Validates feature input data.
 *
 * @param {{ title: string, price: number }} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFeatureInput(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['بيانات غير صالحة'] };
  }

  if (!input.title || input.title.length < MIN_TITLE_LENGTH) {
    errors.push(`العنوان يجب أن يكون ${MIN_TITLE_LENGTH} أحرف على الأقل`);
  }

  if (input.title && input.title.length > MAX_TITLE_LENGTH) {
    errors.push(`العنوان يجب أن لا يتجاوز ${MAX_TITLE_LENGTH} حرف`);
  }

  if (typeof input.price !== 'number' || input.price < 0) {
    errors.push('السعر يجب أن يكون رقم موجب');
  }

  return { valid: errors.length === 0, errors };
}
```

## Test File Template

```js
/**
 * featureModel tests — Unit tests for Feature business logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateFeatureInput } from './featureModel.js';

describe('validateFeatureInput', () => {
  it('should_return_valid_for_correct_input', () => {
    const result = validateFeatureInput({ title: 'آيفون 15', price: 3999 });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('should_reject_empty_title', () => {
    const result = validateFeatureInput({ title: '', price: 100 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('should_reject_negative_price', () => {
    const result = validateFeatureInput({ title: 'منتج', price: -5 });
    assert.equal(result.valid, false);
  });

  it('should_reject_null_input', () => {
    const result = validateFeatureInput(null);
    assert.equal(result.valid, false);
  });
});
```

## Cloudflare Pages Function Template

```js
/**
 * API endpoint: /api/feature
 *
 * Handles [GET/POST] requests for Feature operations.
 * Runs on Cloudflare Pages Functions (Edge).
 */

import { createServerSupabase } from '../_lib/providerApi';

/** @constant Allowed HTTP methods */
const ALLOWED_METHODS = ['GET', 'POST'];

/**
 * Handles incoming requests to /api/feature.
 *
 * @param {EventContext} context - Cloudflare Pages Function context
 * @returns {Response}
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (!ALLOWED_METHODS.includes(request.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createServerSupabase(env);
    // ... business logic
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

## Import Alias Convention

Always use the `@/` alias for project-root imports:
```js
import { supabase } from '@/lib/supabaseClient';
import ProductCard from '@/components/ProductCard';
import { fetchProducts } from '@/services/productsService';
```

The alias is configured in `vite.config.js` as:
```js
'@': path.resolve(__dirname, './')
```
