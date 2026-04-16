insert into public.settings (id, data)
values (
  1,
  jsonb_build_object(
    'content',
    jsonb_build_object(
      'valuePoints',
      jsonb_build_array(
        jsonb_build_object('icon', 'shield-check', 'title', 'تشخيص واضح قبل التنفيذ', 'description', 'نشرح لك سبب المشكلة وخيارات الإصلاح قبل البدء حتى تبقى الصورة واضحة.'),
        jsonb_build_object('icon', 'zap', 'title', 'تنفيذ سريع ومنظم', 'description', 'من استقبال الجهاز وحتى التسليم نعمل على تقليل وقت الانتظار مع متابعة مباشرة.'),
        jsonb_build_object('icon', 'badge-check', 'title', 'قطع موثوقة وضمان', 'description', 'نرشح لك قطعًا مناسبة للاستخدام الفعلي ونوضح البدائل حسب الميزانية.'),
        jsonb_build_object('icon', 'headphones', 'title', 'دعم بعد البيع', 'description', 'فريقنا متاح لمراجعة الأداء والاستفسارات وخطوات الاستخدام بعد الشراء أو الصيانة.')
      ),
      'testimonials',
      jsonb_build_array(
        jsonb_build_object('name', 'أحمد خالد', 'role', 'مالك شركة صغيرة', 'quote', 'تم إصلاح أجهزة المكتب بسرعة مع شرح واضح للتكلفة والخطوات. التجربة كانت مرتبة جدًا.'),
        jsonb_build_object('name', 'سارة عمرو', 'role', 'مصممة جرافيك', 'quote', 'ساعدوني في اختيار ترقية مناسبة لجهازي بدون مبالغة في القطع، والأداء تحسن بشكل ملحوظ.'),
        jsonb_build_object('name', 'محمد ياسين', 'role', 'لاعب وStreamer', 'quote', 'خدمة التجميع كانت نظيفة جدًا، ترتيب الكيابل ممتاز، والجهاز وصل جاهزًا للاستخدام مباشرة.')
      ),
      'faqs',
      jsonb_build_array(
        jsonb_build_object('question', 'كم يستغرق تشخيص العطل؟', 'answer', 'يبدأ التشخيص الأولي عادة خلال نفس اليوم، ويتم إبلاغك بالحالة والخطوات المقترحة فورًا.'),
        jsonb_build_object('question', 'هل يمكن استلام الجهاز من المنزل؟', 'answer', 'نعم، عند تفعيل خيار التوصيل نستقبل بيانات العنوان وننسق آلية الاستلام والتسليم.'),
        jsonb_build_object('question', 'هل توفرون قطعًا بديلة أثناء الصيانة؟', 'answer', 'بحسب نوع الحالة والمخزون المتاح، نوضح لك الخيارات المناسبة قبل تنفيذ أي استبدال.'),
        jsonb_build_object('question', 'هل أستطيع طلب تجميعة كاملة بدل إصلاح جهاز؟', 'answer', 'بالتأكيد، يمكننا مساعدتك في اختيار تجميعة حسب الاستخدام والميزانية مع التركيب والاختبار.')
      ),
      'workingHours',
      jsonb_build_array(
        jsonb_build_object('day', 'السبت - الخميس', 'hours', '10:00 صباحًا - 8:00 مساءً'),
        jsonb_build_object('day', 'الجمعة', 'hours', 'بعد صلاة الجمعة - 8:00 مساءً'),
        jsonb_build_object('day', 'الدعم عبر واتساب', 'hours', 'متاح يوميًا للرد على الاستفسارات السريعة')
      )
    )
  )
)
on conflict (id) do update
set
  data = jsonb_set(coalesce(public.settings.data, '{}'::jsonb), '{content}', excluded.data -> 'content', true),
  updated_at = now();
