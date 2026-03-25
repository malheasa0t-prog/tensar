import { NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ADMIN_PANEL_ENABLED } from '@/lib/adminFeature';
import {
  isAccessoryCatalogCategoryId,
  isAccessoryProductCategoryId,
} from '@/lib/accessoryCatalog';

export const runtime = 'nodejs';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

async function getValidatedSubcategory(categoryId) {
  const cleanCategoryId = normalizeText(categoryId);

  if (!cleanCategoryId) {
    throw new Error('الفئة الفرعية مطلوبة.');
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, parent_id, status')
    .eq('id', cleanCategoryId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('الفئة الفرعية المحددة غير موجودة.');
  }

  if (!data.parent_id) {
    throw new Error('يجب ربط المنتج بفئة فرعية، وليس بفئة رئيسية مباشرة.');
  }

  return data;
}

async function buildProductPayload(body) {
  const name = normalizeText(body?.name);
  const brand = normalizeText(body?.brand);
  const description = normalizeText(body?.description);
  const rawStatus = normalizeText(body?.status) || 'active';
  const status = rawStatus === 'hidden' ? 'inactive' : rawStatus;

  if (!name) {
    throw new Error('اسم المنتج مطلوب.');
  }

  if (!['active', 'inactive'].includes(status)) {
    throw new Error('حالة المنتج غير صالحة.');
  }

  const subcategory = await getValidatedSubcategory(body?.category_id);

  return {
    name,
    category_id: subcategory.id,
    brand: brand || null,
    price: normalizeNumber(body?.price, 0),
    discount_price: normalizeNumber(body?.discount_price, 0),
    quantity: normalizeInteger(body?.quantity, 0),
    status,
    description: description || null,
    low_stock_alert: normalizeInteger(body?.low_stock_alert, 5),
  };
}

function buildProductsResponse(products = [], categories = []) {
  const categoriesMap = new Map(categories.map((category) => [category.id, category]));

  return products.map((product) => {
    const subcategory = categoriesMap.get(product.category_id) || null;
    const mainCategory = subcategory?.parent_id ? categoriesMap.get(subcategory.parent_id) || null : null;

    return {
      ...product,
      subcategory_name: subcategory?.name || '',
      main_category_id: mainCategory?.id || '',
      main_category_name: mainCategory?.name || '',
      category_name: mainCategory ? `${mainCategory.name} / ${subcategory?.name || ''}` : subcategory?.name || '',
    };
  });
}

export async function GET(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const [productsRes, categoriesRes] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id,name,category_id,brand,price,discount_price,quantity,status,description,low_stock_alert,updated_at,created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('categories')
        .select('id,name,parent_id,sort_order,status,slug')
        .order('sort_order', { ascending: true }),
    ]);

    if (productsRes.error || categoriesRes.error) {
      return NextResponse.json({ success: false, error: 'تعذر تحميل بيانات المنتجات.' }, { status: 500 });
    }

    const categories = (categoriesRes.data || []).filter((category) => !isAccessoryCatalogCategoryId(category.id));
    const products = buildProductsResponse(
      (productsRes.data || []).filter((product) => !isAccessoryProductCategoryId(product.category_id)),
      categories
    );

    return NextResponse.json({
      success: true,
      data: {
        products,
        categories,
      },
    });
  } catch (error) {
    console.error('Admin products GET error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ غير متوقع.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const payload = await buildProductPayload(body);

    const id = `prd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([{
        id,
        ...payload,
        specs: [],
        images: [],
        variants: [],
        rating: 0,
        sold: 0,
      }])
      .select('id,name')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'تعذر إنشاء المنتج.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'حدث خطأ غير متوقع.' }, { status: 400 });
  }
}

export async function PATCH(request) {
  if (!ADMIN_PANEL_ENABLED) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  const { errorResponse } = await requireAdminRequest(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const id = normalizeText(body?.id);

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف المنتج مطلوب.' }, { status: 400 });
    }

    const payload = await buildProductPayload(body);

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id,name')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'تعذر تحديث المنتج.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'حدث خطأ غير متوقع.' }, { status: 400 });
  }
}
