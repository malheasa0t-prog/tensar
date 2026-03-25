import AppIcon from '@/components/AppIcon';

/**
 * Summary card content shown inside the category hero.
 *
 * @param {{ hasSubCategories: boolean }} props
 * @returns {JSX.Element}
 */
export default function CategoryHeroSummary({ hasSubCategories }) {
  if (hasSubCategories) {
    return (
      <div className="hero-summary-card">
        <div className="hero-summary-list">
          <div className="hero-summary-item">
            <span className="hero-summary-icon">
              <AppIcon name="folder-open" size={18} />
            </span>
            <div>
              <strong>الفئات أولًا</strong>
              <span>
                هذه الفئة الرئيسية تعرض الأقسام الفرعية المرتبطة بها أولًا حتى يبقى المسار أوضح
                وأكثر تنظيمًا.
              </span>
            </div>
          </div>

          <div className="hero-summary-item">
            <span className="hero-summary-icon">
              <AppIcon name="boxes" size={18} />
            </span>
            <div>
              <strong>عدد المنتجات قبل الدخول</strong>
              <span>
                كل بطاقة فرعية توضح عدد المنتجات داخلها لتسهيل اختيار القسم المناسب قبل التنقل.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-summary-card">
      <div className="hero-summary-list">
        <div className="hero-summary-item">
          <span className="hero-summary-icon">
            <AppIcon name="shopping-bag" size={18} />
          </span>
          <div>
            <strong>منتجات هذه الفئة</strong>
            <span>
              جميع العناصر هنا مرتبطة بهذه الفئة مباشرة، مع بطاقات موحدة ومسار واضح نحو صفحة
              المنتج.
            </span>
          </div>
        </div>

        <div className="hero-summary-item">
          <span className="hero-summary-icon">
            <AppIcon name="arrow-left" size={18} />
          </span>
          <div>
            <strong>رجوع أوضح داخل الشجرة</strong>
            <span>
              إذا كانت هذه فئة فرعية فهناك رجوع مباشر إلى الفئة الأم بدون فقدان السياق.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
