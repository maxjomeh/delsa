import { Cpu, Zap, Shield, Rocket, ChevronLeft, Check, Terminal, Share2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 10px rgba(51, 255, 0, 0.2); }
          50% { text-shadow: 0 0 20px rgba(51, 255, 0, 0.5); }
        }
        html { scroll-behavior: smooth; }
      `}} />

      <div style={{ backgroundColor: '#000', color: '#fff', fontFamily: 'Tahoma, Segoe UI, sans-serif', direction: 'rtl' }}>
        
        {/* --- Navigation --- */}
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 5%', borderBottom: '1px solid #111', position: 'sticky', top: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#33ff00' }}>DELSA <span style={{color:'#fff'}}>AI</span></div>
          <div style={{ display: 'flex', gap: '30px', fontSize: '14px', color: '#888' }}>
            <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>قابلیت‌ها</a>
            <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>تعرفه‌ها</a>
            <a href="/dashboard" style={{ color: '#33ff00', textDecoration: 'none', border: '1px solid #33ff00', padding: '5px 15px', borderRadius: '8px' }}>ورود به پنل</a>
          </div>
        </nav>

        {/* --- Hero Section --- */}
        <section style={{ padding: '100px 5%', textAlign: 'center', background: 'radial-gradient(circle at 50% 50%, #0a1a05 0%, #000 70%)' }}>
          <div style={{ animation: 'float 6s ease-in-out infinite', display: 'inline-block' }}>
             <Cpu size={80} color="#33ff00" strokeWidth={1} />
          </div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginTop: '30px', marginBottom: '20px', animation: 'glow 3s infinite' }}>
            نسل جدید مدیریت هوشمند با <span style={{ color: '#33ff00' }}>دِلسا</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#888', maxWidth: '700px', margin: '0 auto 40px' }}>
            پلتفرم پیشرفته مدیریت اشتراک و اتوماسیون مبتنی بر هوش مصنوعی. امنیت، سرعت و دقت را در یک اکوسیستم تجربه کنید.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button style={{ backgroundColor: '#33ff00', color: '#000', padding: '15px 40px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}>شروع رایگان</button>
            <button style={{ backgroundColor: 'transparent', color: '#fff', padding: '15px 40px', borderRadius: '12px', border: '1px solid #333', fontSize: '18px', cursor: 'pointer' }}>مشاهده دمو</button>
          </div>
        </section>

        {/* --- Features Section --- */}
        <section id="features" style={{ padding: '80px 5%', backgroundColor: '#050505' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '60px', fontSize: '2rem' }}>چرا <span style={{ color: '#33ff00' }}>دِلسا؟</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
            {[
              { icon: <Zap color="#33ff00" />, title: "پردازش آنی", desc: "تمامی درخواست‌های شما در کمتر از ۱۰۰ میلی‌ثانیه پردازش می‌شوند." },
              { icon: <Shield color="#33ff00" />, title: "امنیت نظامی", desc: "رمزنگاری End-to-End برای تمامی داده‌های حساس اشتراک کاربران." },
              { icon: <Terminal color="#33ff00" />, title: "یکپارچگی کامل", desc: "اتصال آسان به APIهای مختلف و سیستم‌های مالی شما." },
            ].map((f, i) => (
              <div key={i} style={{ padding: '30px', background: '#0a0a0a', borderRadius: '20px', border: '1px solid #111', transition: '0.3s' }}>
                <div style={{ marginBottom: '20px' }}>{f.icon}</div>
                <h3 style={{ marginBottom: '15px' }}>{f.title}</h3>
                <p style={{ color: '#666', lineHeight: '1.6' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Pricing Section --- */}
        <section id="pricing" style={{ padding: '80px 5%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '60px', fontSize: '2rem' }}>پلن‌های اشتراک</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
            
            {/* Plan Card */}
            <div style={{ width: '320px', padding: '40px', background: '#0a0a0a', borderRadius: '24px', border: '1px solid #1a1a1a', position: 'relative' }}>
              <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>حرفه‌ای</h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '30px' }}>۴۹,۰۰۰ <span style={{ fontSize: '14px', color: '#666' }}>تومان / ماه</span></div>
              <ul style={{ list-style: 'none', padding: 0, color: '#aaa', marginBottom: '40px' }}>
                <li style={{ marginBottom: '15px' }}><Check size={16} color="#33ff00" /> دسترسی به داشبورد AI</li>
                <li style={{ marginBottom: '15px' }}><Check size={16} color="#33ff00" /> پشتیبانی ۲۴/۷</li>
                <li style={{ marginBottom: '15px' }}><Check size={16} color="#33ff00" /> اتصال به گیت‌هاب</li>
              </ul>
              <button style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #33ff00', color: '#33ff00', background: 'transparent', cursor: 'pointer' }}>انتخاب پلن</button>
            </div>

            {/* Premium Plan (Highlighted) */}
            <div style={{ width: '320px', padding: '40px', background: '#0a0a0a', borderRadius: '24px', border: '2px solid #33ff00', boxShadow: '0 0 30px rgba(51, 255, 0, 0.1)' }}>
              <div style={{ position: 'absolute', top: '-15px', right: '20px', background: '#33ff00', color: '#000', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>پیشنهادی</div>
              <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>سازمانی</h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '30px' }}>۱۸۹,۰۰۰ <span style={{ fontSize: '14px', color: '#666' }}>تومان / ماه</span></div>
              <ul style={{ list-style: 'none', padding: 0, color: '#aaa', marginBottom: '40px' }}>
                <li style={{ marginBottom: '15px' }}><Check size={16} color="#33ff00" /> تمام امکانات حرفه‌ای</li>
                <li style={{ marginBottom: '15px' }}><Check size={16} color="#33ff00" /> ظرفیت نامحدود</li>
                <li style={{ marginBottom: '15px' }}><Check size={16} color="#33ff00" /> امنیت اختصاصی</li>
              </ul>
              <button style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', color: '#000', background: '#33ff00', fontWeight: 'bold', cursor: 'pointer' }}>خرید آنلاین</button>
            </div>

          </div>
        </section>

        {/* --- Footer --- */}
        <footer style={{ padding: '50px 5%', borderTop: '1px solid #111', textAlign: 'center', color: '#444' }}>
          <div style={{ marginBottom: '20px' }}>
             <Share2 size={24} color="#33ff00" />
          </div>
          <p>© ۲۰۲۴ تمامی حقوق برای سیستم هوشمند دِلسا محفوظ است.</p>
        </footer>

      </div>
    </>
  );
}
