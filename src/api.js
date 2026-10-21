const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const judgeReady = configured && import.meta.env.VITE_JUDGE_ENABLED === 'true';
const { createClient } = configured ? await import('@supabase/supabase-js') : { createClient: null };
export const supabase = configured ? createClient(url, key, {
  auth: { detectSessionInUrl: false, persistSession: true },
}) : null;

export async function api(action, data = {}) {
  if (!supabase) throw new Error('인증 서버 연결을 준비 중입니다. 코드 작성과 파일 저장은 사용할 수 있어요.');
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('발급받은 계정으로 로그인해 주세요.');
  const { data: result, error } = await supabase.functions.invoke('classroom', {
    body: { action, ...data }, timeout: action === 'submit' ? 60000 : 20000,
  });
  if (error) {
    let message = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
    try { message = (await error.context.json()).error || message; } catch { /* Network failure. */ }
    throw new Error(message);
  }
  if (result?.error) throw new Error(result.error);
  return result;
}
export async function login(username, password) {
  if (!supabase) throw new Error('로그인 서버 연결을 준비 중입니다.');
  const name=username.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(name)) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
  const {error}=await supabase.auth.signInWithPassword({email:`${name}@cpp-room.invalid`,password});
  if(error)throw new Error(error.status===429?'로그인 시도가 많아요. 잠시 후 다시 시도해 주세요.':'아이디 또는 비밀번호를 확인해 주세요.');
}
