// ===== TechZone Admin - Products =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const helpers = window.AdminProductsHelpers;
    const form = window.AdminProductsForm;
    const bulkActions = window.AdminBulkActions;

    function switchAdminSection(section) {
        A.currentSection = section;
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.section === section);
        });
        A.renderSection(section);
    }

    function getProductsContext() {
        const accessoryCatalog = helpers.getAccessoryCatalog(A, TZ);
        const products = TZ.clone(TZ.db.products).filter((product) => !helpers.isAccessoryProduct(TZ, product));

        return {
            accessoryCatalog,
            products,
            mainCategories: helpers.getMainCategories(TZ, accessoryCatalog),
            subCategories: helpers.getSubCategories(TZ, accessoryCatalog)
        };
    }

    function renderProducts() {
        const context = getProductsContext();
        A.adminContent.innerHTML = helpers.buildProductsViewMarkup({
            A,
            TZ,
            bulkActions,
            products: context.products,
            mainCategories: context.mainCategories,
            subCategories: context.subCategories
        });

        form.bindProductEvents({
            A,
            TZ,
            helpers,
            accessoryCatalog: context.accessoryCatalog,
            renderProducts,
            switchAdminSection
        });

        form.mountProductBulkActions({
            A,
            TZ,
            helpers,
            bulkActions,
            renderProducts
        });
    }

    A.sections.products = renderProducts;
})();
