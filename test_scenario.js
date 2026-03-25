const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://phwsgpceksjplkbhtpri.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBod3NncGNla3NqcGxrYmh0cHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTMwMzIsImV4cCI6MjA4NjIyOTAzMn0.volcnhVx6lg7LeZbwVZ6Cx-cdY4tI7Z3FQUnGNWNDCw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function generateId(prefix = '') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

async function runScenario() {
    console.log("=== بدء السيناريو التجريبي ===");

    // 1. إنشاء مجموعة أم (Mother Category)
    const motherCatId = generateId('cat-');
    console.log("1. يتم إنشاء مجموعة أم...");
    const { error: motherErr } = await supabase.from('categories').insert([{
        id: motherCatId,
        name: "🌐 مجموعة أم تجريبية",
        parent_id: null,
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=200&h=200", 
        description: "مجموعة أم تظهر في الرئيسية وفي شريط التنقل العلوي",
        sort_order: 1
    }]);

    if (motherErr) {
        console.error("خطأ في إنشاء المجموعة الأم:", motherErr);
        return;
    }
    console.log("✅ تم إنشاء المجموعة الأم بنجاح! ID:", motherCatId);

    // 2. إنشاء فئة عادية (تحت المجموعة الأم)
    const subCatId = generateId('cat-');
    console.log("2. يتم إنشاء فئة عادية تابعة...");
    const { error: subErr } = await supabase.from('categories').insert([{
        id: subCatId,
        name: "📁 فئة عادية تجريبية",
        parent_id: motherCatId,
        icon: "✨",
        description: "فئة عادية موجودة بداخل المجموعة الأم",
        sort_order: 1
    }]);

    if (subErr) {
        console.error("خطأ في إنشاء الفئة الفرعية:", subErr);
        return;
    }
    console.log("✅ تم إنشاء الفئة العادية بنجاح! ID:", subCatId);

    // 3. إنشاء خدمة (تحت الفئة العادية)
    const serviceId = generateId('srv-');
    console.log("3. يتم إنشاء خدمة تابعة للفئة العادية...");
    const { error: srvErr } = await supabase.from('services').insert([{
        id: serviceId,
        name: "⚡ خدمة تجريبية مميزة",
        category_id: subCatId,
        price: 49.99,
        cost_price: 30.00,
        status: "active",
        description: "هذه الخدمة تظهر عندما يضغط المستخدم على الفئة العادية الموجودة داخل المجموعة الأم.",
        min_qty: 1,
        max_qty: 10,
        speed: "فوري",
        image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=200"
    }]);

    if (srvErr) {
        console.error("خطأ في إنشاء الخدمة:", srvErr);
        return;
    }
    console.log("✅ تم إنشاء الخدمة بنجاح!");
    console.log("\n=== تمت محاكاة السيناريو بنجاح! ===");
}

runScenario();
