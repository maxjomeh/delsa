import { Cpu, Zap, ShieldCheck, Activity, Globe } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ 
      backgroundColor: '#0a0a0a', 
      backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000 100%)',
      minHeight: '100vh', 
      color: '#fff', 
      fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      direction: 'rtl'
    }}>
      {/* Container اصلی با افکت شیشه‌ای */}
      <div style={{ 
        maxWidth: '450px', 
        width: '100%',
        background: 'rgba(20, 20, 20, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        border: '1px solid #33ff0033',
        padding: '40px',
        boxShadow: '0 0 40px rgba(51, 255, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {/* المان تزیینی نئونی در بالا */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #33ff00, transparent)' }}></div>

        {/* بخش هدر */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(51, 255, 0, 0.1)', marginBottom: '15px', border: '1px solid #33ff00' }}>
            <Cpu size={32} color="#33ff00" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '1px', color: '#fff', textShadow: '0 0 10px rgba(51, 255, 0, 0.5)' }}>
            DELSA <span style={{ color: '#33ff00' }}>AI</span>
          </h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '10px' }}>مدیریت حساب</p>
        </div>

        {/* اطلاعات کاربر */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid #222' }}>
            <Activity size={18} color="#33ff00" />
            <span style={{ fontSize: '15px' }}>وضعیت سیستم: <span style={{ color: '#33ff00' }}>Online</span></span>
          </div>
          
          <div style={{ padding: '20px', borderRadius: '16px', border: '1px dashed #444', position: 'relative' }}>
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>کاربر متصل:</div>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff' }}>مسلم جمعه</div>
            <div style={{ marginTop: '15px', fontSize: '13px', color: '#33ff00', display: 'flex', justifyContent: 'space-between' }}>
              <span>اعتبار باقی‌مانده:</span>
              <span>28 روز </span>
            </div>
            {/* ProgressBar نئونی */}
            <div style={{ width: '100%', height: '4px', background: '#222', borderRadius: '10px', marginTop: '8px' }}>
              <div style={{ width: '75%', height: '100%', background: '#33ff00', boxShadow: '0 0 10px #33ff00', borderRadius: '10px' }}></div>
            </div>
          </div>
        </div>

        {/* دکمه‌های عملیاتی */}
        <div style={{ display: 'grid', gap: '10px' }}>
          <button style={{ 
            background: '#33ff00', 
            color: '#000', 
            border: 'none', 
            padding: '14px', 
            borderRadius: '12px', 
            fontWeight: 'bold', 
            fontSize: '16px', 
            cursor: 'pointer',
            transition: '0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Zap size={18} /> تمدید اشتراک
          </button>
          
          <button style={{ 
            background: 'transparent', 
            color: '#fff', 
            border: '1px solid #444', 
            padding: '12px', 
            borderRadius: '12px', 
            fontSize: '14px', 
            cursor: 'pointer' 
          }}>
            تنظیمات شبکه
          </button>
        </div>

        {/* فوتر */}
        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <Globe size={12} /> پروتکل امنیتی دِلسا فعال است
        </div>
      </div>
    </div>
  );
}
