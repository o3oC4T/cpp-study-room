import { importPKCS8, SignJWT } from 'npm:jose@6.2.2';
import { unzipSync } from 'npm:fflate@0.8.2';
import { readBounded } from './bounded.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error('채점 서버 연결을 준비 중입니다.');
  return value;
}
let cached: { token: string; expires: number } | undefined;

export async function installationToken() {
  if (cached && cached.expires > Date.now() + 120000) return cached.token;
  const pem = required('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'RS256');
  const now = Math.floor(Date.now()/1000);
  const jwt = await new SignJWT({}).setProtectedHeader({alg:'RS256'})
    .setIssuer(required('GITHUB_APP_ID')).setIssuedAt(now-60).setExpirationTime(now+540).sign(key);
  const response = await fetch(`https://api.github.com/app/installations/${required('GITHUB_INSTALLATION_ID')}/access_tokens`, {
    method: 'POST', headers: headers(jwt),
    body: JSON.stringify({
      repositories: [required('COURSE_REPOSITORY').split('/')[1]],
      permissions: { contents: 'write', actions: 'read' },
    }),
  });
  if (!response.ok) throw new Error('GitHub 채점 연결을 확인해 주세요.');
  const data = await response.json();
  cached = { token: data.token, expires: Date.parse(data.expires_at) };
  return cached.token;
}
function headers(token: string) {
  return { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json' };
}
export async function github(path: string, method='GET', body?: unknown): Promise<any> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, headers:headers(await installationToken()), body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GitHub 연결 오류 (${response.status})`);
  if (response.status === 204) return null;
  return await response.json();
}
export function course() {
  const repo = required('COURSE_REPOSITORY');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('저장소 설정 오류');
  return `/repos/${repo}`;
}
export async function commitSolution(submission: any) {
  const path = course();
  // The source is an actual versioned coursework contribution; workflows stay server-owned.
  for (let attempt=0; attempt<3; attempt++) {
    const ref = await github(`${path}/git/ref/heads/main`);
    const parent = await github(`${path}/git/commits/${ref.object.sha}`);
    const entry = `submissions/${submission.id}/main.cpp`;
    const manifest = {
      schema:1, submissionId:submission.id, problemId:submission.problem_id,
      mode:submission.mode, source:entry,
    };
    const tree = await github(`${path}/git/trees`, 'POST', {
      base_tree:parent.tree.sha,
      tree:[
        {path:entry,mode:'100644',type:'blob',content:submission.source},
        {path:'current.json',mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'},
      ],
    });
    const commit = await github(`${path}/git/commits`, 'POST', {
      message:`Practice ${submission.problem_id} (${submission.id})`,
      tree:tree.sha,parents:[ref.object.sha],
    });
    try {
      await github(`${path}/git/refs/heads/main`, 'PATCH', { sha:commit.sha, force:false });
      return commit.sha as string;
    } catch (error) {
      if (attempt===2 || !/\((409|422)\)/.test((error as Error).message)) throw error;
    }
  }
  throw new Error('제출 저장에 실패했습니다.');
}
export async function readReport(runId: number) {
  const listing = await github(`${course()}/actions/runs/${runId}/artifacts`);
  const artifact = listing.artifacts.find((a: any) => a.name === 'grade-result' && !a.expired);
  if (!artifact || artifact.size_in_bytes > 524288) throw new Error('채점 결과 파일이 없거나 너무 큽니다.');
  const response = await fetch(`https://api.github.com${course()}/actions/artifacts/${artifact.id}/zip`, {
    headers:headers(await installationToken()),
  });
  if (!response.ok) throw new Error('채점 결과 다운로드에 실패했습니다.');
  const raw = await readBounded(response.body,524288);
  const archive = unzipSync(raw, { filter: (file) => file.name === 'result.json' && file.originalSize <= 262144 });
  const content = archive['result.json'];
  if (!content || content.length > 262144) throw new Error('잘못된 채점 결과 파일입니다.');
  return JSON.parse(new TextDecoder().decode(content));
}
