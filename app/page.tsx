import { CreditCard, User, Clock, CheckCircle } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ fontFamily: 'Tahoma, sans-serif', backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '40px 20px', direction: 'rtl' }}>
      <main style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h1 style={{ textAlign: 'center', color: '#1a73e8', marginBottom: '30px' }}>پنل اشتراک دلسا</h1>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
          <p style={{ margin: '5px 0' }}><strong>کاربر:</strong> مسلم آقاخانی</p>
          <p style={{ margin: '5px 0' }}><strong>سرویس:</strong> پلتفرم هوشمند Delsa</p>
        </div>

        <div style={{ display: 'grid', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee' }}>
            <span>وضعیت اشتراک:</span>
            <span style={{ color: '#28a745', fontWeight: 'bold' }}>فعال</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee' }}>
            <span>اعتبار باقی‌مانده:</span>
            <span>۴۵ روز</span>
          </div>
        </div>

        <button style={{ width: '100%', marginTop: '30px', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: '#fff', fontSize: '16px', cursor: 'pointer' }}>
          تمدید یا ارتقا پلن
        </button>
      </main>
    </div>
  );
}
