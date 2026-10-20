const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
const { createClient } = configured ? await import('@supabase/supabase-js') : { createClient: null };
export const supabase = configured ? createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
}) : null;

export async function api(action, data = {}) {
  if (!supabase) throw new Error('온라인 채점 연결을 준비 중입니다. 지금은 코드를 작성하고 .cpp 파일로 저장할 수 있어요.');
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('GitHub 로그인 후 이용할 수 있어요.');
  const { data: result, error } = await supabase.functions.invoke('classroom', { body: { action, ...data } });
  if (error) {
    let message = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
    try { message = (await error.context.json()).error || message; } catch { /* Network failure. */ }
    throw new Error(message);
  }
  if (result?.error) throw new Error(result.error);
  return result;
}

export async function login() {
  if (!supabase) throw new Error('GitHub 로그인과 온라인 채점 연결을 준비 중입니다.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}
