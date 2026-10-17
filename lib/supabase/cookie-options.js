// Shared persistent cookie defaults; Supabase manages expiry and token refresh.
export const sessionCookieOptions = {path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production'};
