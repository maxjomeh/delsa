// Human-visible outcome of the one-shot Instagram outbox.
// A DB-side rejection before attempt_count=1 is NOT a provider rejection.
export const localOutboxReason={
 review_missing_before_send:'درخواست پیش از ارسال متوقف شد؛ پروندهٔ بررسی موجود نیست.',
 conversation_changed_before_send:'قبل از ارسال، مکالمه تغییر کرده است. درخواست قبلی لغو شد.',
 review_closed_before_send:'پرونده پیش از ارسال بسته شده است. این پیام ارسال نشد.',
 customer_missing_before_send:'پروندهٔ مشتری پیش از ارسال در دسترس نیست.',
 contact_opted_out_before_send:'قبل از ارسال، اجازهٔ تماس مشتری لغو شده است.',
 reply_window_closed_before_send:'بازهٔ مجاز پاسخ به اینستاگرام تمام شده است؛ پیام اصلاً ارسال نشد.',
 invalid_inbound_time_before_send:'زمان پیام ورودی معتبر نیست؛ ارسال متوقف شد.',
 newer_business_reply_before_send:'پاسخ جدیدتری در گفتگو ثبت شده است؛ پیام قبلی ارسال نشد.',
 reply_already_sent_from_platform:'پاسخ در خود اینستاگرام ثبت شده است؛ ارسال تکراری انجام نشد.',
 window_closed:'بازهٔ مجاز ارسال تمام شده است؛ درخواست بدون تماس با ارائه‌دهنده لغو شد.',
 conversation_stale:'نسخهٔ مکالمه تغییر کرده است؛ ارسال انجام نشد.',
 contact_opted_out:'مشتری اجازهٔ تماس ندارد؛ ارسال انجام نشد.'
};
export function outboxStatusText(record){
 if(!record)return '';
 const {status,attempt_count,provider_error_code}=record;
 if(status==='accepted')return 'Zernio دریافت پیام را پذیرفته؛ تحویل یا خوانده‌شدن تأیید نشده است.';
 if(status==='unknown')return 'نتیجهٔ درخواست نامشخص است؛ ارسال مجدد خودکار یا دستی نکنید.';
 if(status==='sending')return 'تلاش ارسال در جریان است یا نتیجهٔ نهایی آن هنوز بررسی نشده.';
 if(status==='pending')return 'در صف، بدون تلاش ثبت‌شده برای ارسال.';
 if(status==='rejected'){
  if(attempt_count===0)return localOutboxReason[provider_error_code]||'این درخواست پیش از ارسال لغو شد؛ هیچ تلاشی به ثبت نرسید.';
  return 'درخواست توسط ارائه‌دهنده رد شده است؛ علت و وضعیت واقعی باید بررسی شود.';
 }
 return 'وضعیت ارسال نیازمند بررسی است.';
}
