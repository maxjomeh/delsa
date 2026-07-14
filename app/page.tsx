import { Cpu, Zap, Activity, Globe } from 'lucide-react';

export default function Home() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes backgroundMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ai-card::before {
          content: "";
          position: absolute;
          inset: -2px;
          background: conic-gradient(from 0deg, transparent 70%, #33ff00, #33ff00);
          animation: rotate 4s linear infinite;
          z-index: -1;
        }
      `}} />

      <div style={{ 
        backgroundColor: '#050505', 
        background: 'linear-gradient(-45deg, #050505, #111, #0a1a05, #000)',
        backgroundSize: '400% 400%',
        animation: 'backgroundMove 15s ease infinite',
        minHeight: '100vh', 
        color: '#fff', 
        fontFamily: 'Segoe UI, Tahoma, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        direction: 'rtl'
      }}>
        
        {/* کارت اصلی با حاشیه چرخشی */}
        <div className="ai-card" style={{ 
          maxWidth: '420px', 
          width: '100%',
          background: '#0a0a0a',
          borderRadius: '24px',
          padding: '2px', // فضا برای دیدن حاشیه انیمیشنی
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* محتوای داخلی کارت */}
          <div style={{
            background: 'rgba(10, 10, 10, 0.95)',
            borderRadius: '22px',
            padding: '40px',
            height: '100%'
          }}>
            
            {/* هدر با افکت پالس */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ 
                display: 'inline-flex', 
                padding: '12px', 
                borderRadius: '50%', 
                background: 'rgba(51, 255, 0, 0.05)', 
                marginBottom: '15px', 
                border: '1px solid #33ff00',
                boxShadow: '0 0 20px rgba(51, 255, 0, 0.2)',
                animation: 'pulse 2s infinite'
              }}>
                <Cpu size={32} color="#33ff00" />
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 10px rgba(51, 255, 0, 0.3)' }}>
                DELSA <span style={{ color: '#33ff00' }}>AI</span>
              </h1>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #333, transparent)', marginTop: '10px' }}></div>
            </div>

            {/* وضعیت کاربر */}
            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px', background: 'rgba(51,255,0,0.03)', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#33ff00', boxShadow: '0 0 10px #33ff00' }}></div>
                <span style={{ fontSize: '14px', color: '#888' }}>سیستم فعال و ایمن</span>
              </div>
              
              <div style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#111', border: '1px solid #222' }}>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>شناسه اپراتور:</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#eee' }}>مسلم جمعه</div>
                
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span style={{ color: '#888' }}>پایداری اشتراک:</span>
                    <span style={{ color: '#33ff00' }}>28 روز باقی‌مانده</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#222', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ width: '70%', height: '100%', background: 'linear-gradient(90deg, #33ff00, #1a8800)', boxShadow: '0 0 10px rgba(51, 255, 0, 0.5)' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* دکمه‌های شیشه‌ای نئونی */}
            <div style={{ display: 'grid', gap: '12px' }}>
              <button style={{ 
                background: '#33ff00', 
                color: '#000', 
                border: 'none', 
                padding: '14px', 
                borderRadius: '12px', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(51, 255, 0, 0.3)'
              }}>
                <Zap size={18} fill="#000" /> تمدید سیکل زمانی
              </button>
              
              <button style={{ 
                background: 'rgba(255,255,255,0.02)', 
                color: '#aaa', 
                border: '1px solid #333', 
                padding: '12px', 
                borderRadius: '12px', 
                cursor: 'pointer',
                fontSize: '13px'
              }}>
                دسترسی به ترمینال
              </button>
            </div>

            {/* فوتر کوچک */}
            <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#444', letterSpacing: '1px' }}>
              <Globe size={10} style={{ verticalAlign: 'middle', marginLeft: '5px' }} />
              ENCRYPTED CONNECTION ESTABLISHED
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
