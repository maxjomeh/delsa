const tx=s=>s; // marks Persian UI text; the caller translates it with the `t` it passes in
// Human-visible outcome of the one-shot Instagram outbox.
// A DB-side rejection before attempt_count=1 is NOT a provider rejection.
export const localOutboxReason={
 review_missing_before_send:tx('درخواست پیش از ارسال متوقف شد؛ پروندهٔ بررسی موجود نیست.'),
 conversation_changed_before_send:tx('قبل از ارسال، مکالمه تغییر کرده است. درخواست قبلی لغو شد.'),
 review_closed_before_send:tx('پرونده پیش از ارسال بسته شده است. این پیام ارسال نشد.'),
 customer_missing_before_send:tx('پروندهٔ مشتری پیش از ارسال در دسترس نیست.'),
 contact_opted_out_before_send:tx('قبل از ارسال، اجازهٔ تماس مشتری لغو شده است.'),
 reply_window_closed_before_send:tx('بازهٔ مجاز پاسخ به اینستاگرام تمام شده است؛ پیام اصلاً ارسال نشد.'),
 invalid_inbound_time_before_send:tx('زمان پیام ورودی معتبر نیست؛ ارسال متوقف شد.'),
 newer_business_reply_before_send:tx('پاسخ جدیدتری در گفتگو ثبت شده است؛ پیام قبلی ارسال نشد.'),
 reply_already_sent_from_platform:tx('پاسخ در خود اینستاگرام ثبت شده است؛ ارسال تکراری انجام نشد.'),
 window_closed:tx('بازهٔ مجاز ارسال تمام شده است؛ درخواست بدون تماس با ارائه‌دهنده لغو شد.'),
 conversation_stale:tx('نسخهٔ مکالمه تغییر کرده است؛ ارسال انجام نشد.'),
 contact_opted_out:tx('مشتری اجازهٔ تماس ندارد؛ ارسال انجام نشد.')
};
export function outboxStatusText(record,t=s=>s){
 if(!record)return '';
 const {status,attempt_count,provider_error_code}=record;
 if(status==='accepted')return t('Zernio دریافت پیام را پذیرفته؛ تحویل یا خوانده‌شدن تأیید نشده است.');
 if(status==='unknown')return t('نتیجهٔ درخواست نامشخص است؛ ارسال مجدد خودکار یا دستی نکنید.');
 if(status==='sending')return t('تلاش ارسال در جریان است یا نتیجهٔ نهایی آن هنوز بررسی نشده.');
 if(status==='pending')return t('در صف، بدون تلاش ثبت‌شده برای ارسال.');
 if(status==='rejected'){
  if(attempt_count===0)return (localOutboxReason[provider_error_code]?t(localOutboxReason[provider_error_code]):t('این درخواست پیش از ارسال لغو شد؛ هیچ تلاشی به ثبت نرسید.'));
  return t('درخواست توسط ارائه‌دهنده رد شده است؛ علت و وضعیت واقعی باید بررسی شود.');
 }
 return t('وضعیت ارسال نیازمند بررسی است.');
}
