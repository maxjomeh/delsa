import {
  Cpu,
  Zap,
  Shield,
  Terminal,
  Check,
  Share2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div
      style={{
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: "Tahoma, Segoe UI, sans-serif",
        direction: "rtl",
        minHeight: "100vh",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }

            @keyframes glow {
              0%, 100% { text-shadow: 0 0 10px rgba(51,255,0,0.2); }
              50% { text-shadow: 0 0 20px rgba(51,255,0,0.5); }
            }

            html {
              scroll-behavior: smooth;
            }
          `,
        }}
      />

      {/* Navigation */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 5%",
          borderBottom: "1px solid #111",
          position: "sticky",
          top: 0,
          backgroundColor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(10px)",
          zIndex: 100,
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#33ff00" }}>
          DELSA <span style={{ color: "#fff" }}>AI</span>
        </div>

        <div style={{ display: "flex", gap: "20px", fontSize: "14px", color: "#888" }}>
          <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>
            قابلیت‌ها
          </a>
          <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>
            تعرفه‌ها
          </a>
          <a
            href="/dashboard"
            style={{
              color: "#33ff00",
              textDecoration: "none",
              border: "1px solid #33ff00",
              padding: "6px 14px",
              borderRadius: "8px",
            }}
          >
            ورود به پنل
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          padding: "100px 5%",
          textAlign: "center",
          background: "radial-gradient(circle at 50% 50%, #0a1a05 0%, #000 70%)",
        }}
      >
        <div style={{ animation: "float 6s ease-in-out infinite", display: "inline-block" }}>
          <Cpu size={80} color="#33ff00" strokeWidth={1.5} />
        </div>

        <h1
          style={{
            fontSize: "3.2rem",
            fontWeight: 900,
            marginTop: "30px",
            marginBottom: "20px",
            animation: "glow 3s infinite",
          }}
        >
          نسل جدید مدیریت هوشمند با <span style={{ color: "#33ff00" }}>دِلسا</span>
        </h1>

        <p
          style={{
            fontSize: "1.15rem",
            color: "#888",
            maxWidth: "700px",
            margin: "0 auto 40px",
            lineHeight: 1.9,
          }}
        >
          پلتفرم مدیریت اشتراک، اتوماسیون و سرویس‌های هوشمند برای کسب‌وکارهای مدرن.
          سریع، امن و آماده برای توسعه.
        </p>

        <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            style={{
              backgroundColor: "#33ff00",
              color: "#000",
              padding: "15px 40px",
              borderRadius: "12px",
              border: "none",
              fontWeight: "bold",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            شروع رایگان
          </button>

          <button
            style={{
              backgroundColor: "transparent",
              color: "#fff",
              padding: "15px 40px",
              borderRadius: "12px",
              border: "1px solid #333",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            مشاهده دمو
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "80px 5%", backgroundColor: "#050505" }}>
        <h2 style={{ textAlign: "center", marginBottom: "60px", fontSize: "2rem" }}>
          چرا <span style={{ color: "#33ff00" }}>دِلسا؟</span>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "30px",
          }}
        >
          {[
            {
              icon: <Zap color="#33ff00" />,
              title: "پردازش سریع",
              desc: "درخواست‌ها و عملیات‌ها در کمترین زمان پردازش می‌شوند.",
            },
            {
              icon: <Shield color="#33ff00" />,
              title: "امنیت بالا",
              desc: "داده‌های کاربران با لایه‌های امنیتی مطمئن محافظت می‌شوند.",
            },
            {
              icon: <Terminal color="#33ff00" />,
              title: "اتصال‌پذیری کامل",
              desc: "امکان اتصال به سیستم‌های مختلف، API و ابزارهای توسعه.",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "30px",
                background: "#0a0a0a",
                borderRadius: "20px",
                border: "1px solid #111",
              }}
            >
              <div style={{ marginBottom: "20px" }}>{item.icon}</div>
              <h3 style={{ marginBottom: "15px" }}>{item.title}</h3>
              <p style={{ color: "#666", lineHeight: "1.8" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "80px 5%" }}>
        <h2 style={{ textAlign: "center", marginBottom: "60px", fontSize: "2rem" }}>
          پلن‌های اشتراک
        </h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "320px",
              padding: "40px",
              background: "#0a0a0a",
              borderRadius: "24px",
              border: "1px solid #1a1a1a",
            }}
          >
            <h3 style={{ fontSize: "24px", marginBottom: "10px" }}>حرفه‌ای</h3>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "30px" }}>
              ۴۹,۰۰۰
              <span style={{ fontSize: "14px", color: "#666" }}> تومان / ماه</span>
            </div>

            <ul style={{ listStyle: "none", padding: 0, color: "#aaa", marginBottom: "40px" }}>
              <li style={{ marginBottom: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} color="#33ff00" />
                داشبورد هوشمند
              </li>
              <li style={{ marginBottom: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} color="#33ff00" />
                پشتیبانی ۲۴/۷
              </li>
              <li style={{ marginBottom: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} color="#33ff00" />
                اتصال به GitHub
              </li>
            </ul>

            <button
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #33ff00",
                color: "#33ff00",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              انتخاب پلن
            </button>
          </div>

          <div
            style={{
              width: "320px",
              padding: "40px",
              background: "#0a0a0a",
              borderRadius: "24px",
              border: "2px solid #33ff00",
              boxShadow: "0 0 30px rgba(51,255,0,0.12)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-15px",
                right: "20px",
                background: "#33ff00",
                color: "#000",
                padding: "5px 15px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              پیشنهادی
            </div>

            <h3 style={{ fontSize: "24px", marginBottom: "10px" }}>سازمانی</h3>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "30px" }}>
              ۱۸۹,۰۰۰
              <span style={{ fontSize: "14px", color: "#666" }}> تومان / ماه</span>
            </div>

            <ul style={{ listStyle: "none", padding: 0, color: "#aaa", marginBottom: "40px" }}>
              <li style={{ marginBottom: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} color="#33ff00" />
                همه امکانات حرفه‌ای
              </li>
              <li style={{ marginBottom: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} color="#33ff00" />
                ظرفیت بیشتر
              </li>
              <li style={{ marginBottom: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} color="#33ff00" />
                پشتیبانی ویژه
              </li>
            </ul>

            <button
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                color: "#000",
                background: "#33ff00",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              خرید آنلاین
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "50px 5%",
          borderTop: "1px solid #111",
          textAlign: "center",
          color: "#444",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <Share2 size={24} color="#33ff00" />
        </div>
        <p>© 2026 تمامی حقوق برای DELSA AI محفوظ است.</p>
      </footer>
    </div>
  );
}
