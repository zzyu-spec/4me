#!/usr/bin/env bash
# Run in the user's Google Cloud Shell. No Google token/JSON key is printed or collected.
set -euo pipefail
if [[ "${1:-}" != '--deploy' ]]; then
  printf '%s\n' '사용법: bash tools/deploy-push-cloudshell.sh --deploy' '이 명령은 Blaze 프로젝트에 실제 유료 사용량이 발생할 수 있는 알림 서버를 생성합니다.'
  exit 0
fi
if [[ "${CLOUD_SHELL:-}" != 'true' && -z "${DEVSHELL_PROJECT_ID:-}" && -z "${GOOGLE_CLOUD_SHELL:-}" ]]; then
  printf '%s\n' '이 배포 명령은 본인 Google Cloud Shell 터미널에서 실행해 주세요.' >&2
  exit 1
fi
cd "$(dirname "${BASH_SOURCE[0]}")/.."
task_project='harugyeol-e7866'
task_region='asia-northeast3'
task_runtime_sa="harugyeol-push-runtime@${task_project}.iam.gserviceaccount.com"
task_api="https://${task_region}-${task_project}.cloudfunctions.net/pushApi"
task_env_file="functions/.env.${task_project}"
task_temp=$(mktemp -d)
chmod 700 "$task_temp"
trap 'rm -rf -- "$task_temp"' EXIT
command -v gcloud >/dev/null || { printf '%s\n' 'Google Cloud Shell에서 실행해 주세요.' >&2; exit 1; }
printf '%s\n' '하루결 알림 서버를 설정합니다. 무료 할당량을 넘으면 과금될 수 있습니다.' '기존 일정·투두·일기·사진과 Firestore 보안 규칙은 변경하지 않습니다.'
# The function SDK requires Node 22+. Install a pinned local toolchain only when needed.
if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]]; then
  npm install --prefix "$task_temp/toolchain" --no-audit --no-fund node@22.23.4
  export PATH="$task_temp/toolchain/node_modules/.bin:$PATH"
fi
node -e 'if(require("./firebase-config.json").projectId!=="harugyeol-e7866")process.exit(1)'
task_caller=$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' | head -n 1)
[[ -n "$task_caller" ]] || { printf '%s\n' 'Cloud Shell의 Google 계정 승인(Authorize)을 먼저 완료해 주세요.' >&2; exit 1; }
if [[ "$task_caller" == *'.gserviceaccount.com' ]]; then task_member="serviceAccount:${task_caller}"; else task_member="user:${task_caller}"; fi
task_billing=$(gcloud billing projects describe "$task_project" --format='value(billingEnabled)')
[[ "$task_billing" == 'True' || "$task_billing" == 'true' ]] || { printf '%s\n' '이 프로젝트의 Blaze 결제 연결이 아직 확인되지 않습니다. 새 결제는 하지 말고 프로젝트를 확인해 주세요.' >&2; exit 1; }
gcloud projects describe "$task_project" --format='value(projectId)' >/dev/null
npm ci --prefix functions --ignore-scripts --no-audit --no-fund
npm --prefix functions run check
npm --prefix functions test
node --test tools/push-worker.test.cjs
# Use normal ADC in the user's own Cloud Shell. Never capture or print its token.
task_check_adc() { node - <<'JS'
const {GoogleAuth}=require('./functions/node_modules/google-auth-library');
(async()=>{const auth=new GoogleAuth({projectId:'harugyeol-e7866',scopes:['https://www.googleapis.com/auth/cloud-platform']});await auth.getAccessToken()})().catch(()=>process.exit(1));
JS
}
if ! task_check_adc; then
  printf '%s\n' 'Google 인증이 필요합니다. 아래 Google 절차를 이 Cloud Shell에서만 완료해 주세요. 인증 코드를 채팅에 보내지 마세요.'
  gcloud auth application-default login --no-launch-browser --project "$task_project"
  task_check_adc
fi
# From this line onward this explicit --deploy run creates the real backend.
gcloud services enable compute.googleapis.com firebase.googleapis.com cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com firestore.googleapis.com iam.googleapis.com --project "$task_project" --quiet
if ! gcloud iam service-accounts describe "$task_runtime_sa" --project "$task_project" --format='value(email)' >/dev/null 2>&1; then
  gcloud iam service-accounts create harugyeol-push-runtime --display-name='하루결 푸시 실행' --project "$task_project" --quiet --format='none'
fi
for task_role in roles/datastore.user roles/firebaseauth.viewer; do
  gcloud projects add-iam-policy-binding "$task_project" --member="serviceAccount:${task_runtime_sa}" --role="$task_role" --condition=None --quiet --format='none'
done
gcloud iam service-accounts add-iam-policy-binding "$task_runtime_sa" --member="$task_member" --role=roles/iam.serviceAccountUser --project "$task_project" --quiet --format='none'
task_build_sa=$(gcloud builds get-default-service-account --project "$task_project" --format='value(serviceAccountEmail)')
task_build_sa="${task_build_sa##*/}"
[[ "$task_build_sa" == *'@'*'.gserviceaccount.com' ]] || { printf '%s\n' '실제 Cloud Build 실행 계정을 확인하지 못했습니다. 임의의 계정에 권한을 부여하지 않고 중단합니다.' >&2; exit 1; }
gcloud projects add-iam-policy-binding "$task_project" --member="serviceAccount:${task_build_sa}" --role=roles/run.builder --condition=None --quiet --format='none'
if [[ "$task_build_sa" != *'@cloudbuild.gserviceaccount.com' ]]; then
  gcloud iam service-accounts add-iam-policy-binding "$task_build_sa" --member="$task_member" --role=roles/iam.serviceAccountUser --project "$task_project" --quiet --format='none'
fi
if gcloud secrets describe WEB_PUSH_PRIVATE_KEY --project "$task_project" --format='value(name)' >/dev/null 2>&1; then
  task_public=$(node - "$task_env_file" <<'JS'
const fs=require('node:fs');let s='';try{s=fs.readFileSync(process.argv[2],'utf8')}catch{}const m=s.match(/^WEB_PUSH_PUBLIC_KEY=(.+)$/m);if(m)process.stdout.write(m[1].trim());
JS
)
  if [[ -z "$task_public" ]]; then
    task_public=$(gcloud functions describe pushApi --gen2 --region "$task_region" --project "$task_project" --format='value(serviceConfig.environmentVariables.WEB_PUSH_PUBLIC_KEY)' 2>/dev/null || true)
  fi
  [[ -n "$task_public" ]] || { printf '%s\n' '기존 비밀 키는 보존했습니다. 공개키가 있는 이전 Cloud Shell 작업 폴더에서 다시 실행해 주세요. 키를 자동 교체하지 않습니다.' >&2; exit 1; }
else
  node - "$task_temp" <<'JS'
const fs=require('node:fs'),path=require('node:path'),wp=require('./functions/node_modules/web-push');const key=wp.generateVAPIDKeys();fs.writeFileSync(path.join(process.argv[2],'private'),key.privateKey,{mode:0o600});fs.writeFileSync(path.join(process.argv[2],'public'),key.publicKey,{mode:0o600});
JS
  task_public=$(cat "$task_temp/public")
  gcloud secrets create WEB_PUSH_PRIVATE_KEY --replication-policy=automatic --data-file="$task_temp/private" --project "$task_project" --quiet --format='none'
  rm -f -- "$task_temp/private"
fi
node - "$task_env_file" "$task_public" "$task_runtime_sa" <<'JS'
const fs=require('node:fs');const [file,key,sa]=process.argv.slice(2);if(!/^[A-Za-z0-9_-]{86,90}$/.test(key)||Buffer.from(key,'base64url').length!==65)throw Error('VAPID 공개키 형식을 확인하지 못했습니다.');let text=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';for(const [name,value] of Object.entries({WEB_PUSH_PUBLIC_KEY:key,WEB_PUSH_SUBJECT:'https://zzyu-spec.github.io/4me/',PUSH_RUNTIME_SERVICE_ACCOUNT:sa})){const line=name+'='+value,re=new RegExp('^'+name+'=.*$','m');text=re.test(text)?text.replace(re,line):text+(text&&!text.endsWith('\n')?'\n':'')+line+'\n'}fs.writeFileSync(file,text,{mode:0o600});fs.chmodSync(file,0o600);
JS
gcloud secrets add-iam-policy-binding WEB_PUSH_PRIVATE_KEY --member="serviceAccount:${task_runtime_sa}" --role=roles/secretmanager.secretAccessor --project "$task_project" --quiet --format='none'
task_firebase() { XDG_CONFIG_HOME="$task_temp/firebase-config" npm exec --yes --package=firebase-tools@15.35.0 -- firebase "$@"; }
set +e
task_firebase deploy --only functions:push --project "$task_project" --non-interactive 2>&1 | tee "$task_temp/deploy.log"
task_deploy_status=${PIPESTATUS[0]}
set -e
if [[ "$task_deploy_status" -ne 0 ]]; then
  if grep -Fq 'Functions successfully deployed but could not set up cleanup policy' "$task_temp/deploy.log"; then
    printf '%s\n' '함수 배포는 끝났지만 빌드 이미지 정리 정책은 미설정입니다. 이미지 보관 비용이 생길 수 있으며 기존 저장소 정책을 임의로 바꾸지는 않았습니다.'
  else
    exit "$task_deploy_status"
  fi
fi
for task_function in pushApi sendScheduledPush; do
  task_state=$(gcloud functions describe "$task_function" --gen2 --region "$task_region" --project "$task_project" --format='value(state)')
  task_live_sa=$(gcloud functions describe "$task_function" --gen2 --region "$task_region" --project "$task_project" --format='value(serviceConfig.serviceAccountEmail)')
  [[ "$task_live_sa" == "$task_runtime_sa" ]] || { printf '%s\n' '함수 실행 계정이 준비한 전용 계정과 다릅니다. 배포 완료로 처리하지 않습니다.' >&2; exit 1; }
  [[ "$task_state" == 'ACTIVE' ]] || { printf '%s\n' '함수가 아직 활성화되지 않았습니다.' >&2; exit 1; }
done
task_job=$(gcloud scheduler jobs describe "firebase-schedule-sendScheduledPush-${task_region}" --location "$task_region" --project "$task_project" --format='value(state)')
[[ "$task_job" == 'ENABLED' ]] || { printf '%s\n' '예약 발송 작업이 활성화되지 않았습니다.' >&2; exit 1; }
task_job_sa=$(gcloud scheduler jobs describe "firebase-schedule-sendScheduledPush-${task_region}" --location "$task_region" --project "$task_project" --format='value(httpTarget.oidcToken.serviceAccountEmail)')
[[ "$task_job_sa" == "$task_runtime_sa" ]] || { printf '%s\n' '예약 발송 호출 계정이 올바르지 않습니다.' >&2; exit 1; }
curl --fail --silent --show-error --retry 4 --retry-all-errors --retry-delay 3 --max-time 20 "$task_api/health" > "$task_temp/health.json"
node - "$task_temp/health.json" "$task_public" <<'JS'
const d=require(process.argv[2]);if(d.publicKey!==process.argv[3]||d.version!==1||typeof d.publicKey!=='string'||Buffer.from(d.publicKey,'base64url').length!==65)process.exit(1);
JS
printf '\n%s\n' 'HARUGYEOL_PUSH_DEPLOYED' "서버 확인 완료: ${task_api}" '이 메시지는 서버 준비 완료를 뜻합니다. 휴대폰 알림 수신은 앱에서 연결·허용한 뒤 직접 확인해야 합니다.' '휴대폰 홈 화면의 하루결을 다시 열고, 종 아이콘 → 알림 사용 및 대상·시각 저장 → 이 기기 알림 연결 → 서버 테스트 알림을 눌러 주세요.'
