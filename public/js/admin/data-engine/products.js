// ===== TechZone Admin Data Engine - Products =====
// Category and product mapping plus storefront catalog helpers.

import {
    db
} from './core.js?v=20260426-5';

export function mapCategory(row) {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        parentId: row.parent_id,
        image: row.image,
        description: row.description,
        sortOrder: row.sort_order || 0,
        status: row.status || 'active',
        slug: row.slug || '',
        showInNavbar: row.show_in_navbar !== false
    };
}

export function mapProduct(row) {
    return {
        id: row.id,
        name: row.name,
        categoryId: row.category_id,
        brand: row.brand,
        productType: row.product_type || 'physical',
        price: parseFloat(row.price),
        discountPrice: row.discount_price ? parseFloat(row.discount_price) : 0,
        quantity: row.quantity,
        rating: parseFloat(row.rating),
        sold: row.sold,
        status: row.status,
        description: row.description,
        specs: row.specs || [],
        images: row.images || [],
        variants: row.variants || [],
        lowStockAlert: row.low_stock_alert,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapRepairService(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        price: parseFloat(row.price) || 0,
        duration: row.duration,
        icon: row.icon,
        image: row.image || '',
        status: row.status,
        createdAt: row.created_at
    };
}

function sortProducts(products, sortKey) {
    if (sortKey === 'bestselling') return products.sort((first, second) => second.sold - first.sold);
    if (sortKey === 'newest') {
        return products.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
    }
    if (sortKey === 'price_asc') return products.sort((first, second) => (first.discountPrice || first.price) - (second.discountPrice || second.price));
    if (sortKey === 'price_desc') return products.sort((first, second) => (second.discountPrice || second.price) - (first.discountPrice || first.price));
    if (sortKey === 'rating') return products.sort((first, second) => second.rating - first.rating);
    return products;
}

export function getVisibleCatalogCategories() {
    return db.categories;
}

export function getCatalogProducts() {
    return db.products.filter((product) => product.status === 'active');
}

export function getProductById(productId) {
    return db.products.find((product) => product.id === productId);
}

export function getCategoryName(categoryId) {
    if (!categoryId) return '-';
    const category = db.categories.find((entry) => entry.id === categoryId);
    return category ? category.name : categoryId;
}

export function getCategoryIcon(categoryId) {
    if (!categoryId) return 'fa-box';
    return db.categories.find((category) => category.id === categoryId)?.icon || 'fa-box';
}

export function getFilteredProducts(filters) {
    let filteredProducts = getCatalogProducts();
    if (filters.categoryId) filteredProducts = filteredProducts.filter((product) => product.categoryId === filters.categoryId);
    if (filters.brand) filteredProducts = filteredProducts.filter((product) => product.brand === filters.brand);
    if (filters.minPrice > 0) filteredProducts = filteredProducts.filter((product) => (product.discountPrice || product.price) >= filters.minPrice);
    if (filters.maxPrice > 0) filteredProducts = filteredProducts.filter((product) => (product.discountPrice || product.price) <= filters.maxPrice);
    if (filters.rating > 0) filteredProducts = filteredProducts.filter((product) => product.rating >= filters.rating);
    if (filters.q) {
        const normalizedQuery = filters.q.toLowerCase();
        filteredProducts = filteredProducts.filter((product) => (
            product.name.toLowerCase().includes(normalizedQuery)
            || (product.brand && product.brand.toLowerCase().includes(normalizedQuery))
            || (product.description && product.description.toLowerCase().includes(normalizedQuery))
        ));
    }
    return sortProducts(filteredProducts, filters.sort);
}

export function getFeaturedProducts(limit = 8) {
    return sortProducts(getCatalogProducts(), 'bestselling').slice(0, limit);
}

export function getLatestProducts(limit = 8) {
    return sortProducts(getCatalogProducts(), 'newest').slice(0, limit);
}

export function getBrands() {
    const brands = new Set();
    getCatalogProducts().forEach((product) => {
        if (product.brand) brands.add(product.brand);
    });
    return Array.from(brands).sort();
}

export function getActiveRepairServices() {
    return db.repairServices.filter((service) => service.status === 'active');
}
