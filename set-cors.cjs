// Firebase Storage CORS 설정 스크립트
// Firebase CLI 인증 토큰을 사용하여 GCS REST API로 CORS 설정
// 실행: node set-cors.cjs

const fs = require('fs');
const path = require('path');
const https = require('https');

const BUCKET_NAME = 'ijw-calander.firebasestorage.app';

// Firebase CLI의 인증 토큰 가져오기
function getFirebaseToken() {
  // bash 환경에서는 HOME/.config/configstore, Windows에서는 APPDATA/configstore
  const homeConfig = path.join(require('os').homedir(), '.config', 'configstore');
  const appDataConfig = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'configstore')
    : null;
  const configDir = fs.existsSync(path.join(homeConfig, 'firebase-tools.json'))
    ? homeConfig
    : (appDataConfig || homeConfig);

  const tokenFile = path.join(configDir, 'firebase-tools.json');
  if (!fs.existsSync(tokenFile)) {
    throw new Error('Firebase CLI 인증 파일을 찾을 수 없습니다. firebase login을 먼저 실행하세요.');
  }

  const config = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  const tokens = config.tokens;
  if (!tokens || !tokens.access_token) {
    throw new Error('Firebase CLI 토큰이 없습니다. firebase login을 먼저 실행하세요.');
  }

  return tokens;
}

// 토큰 갱신
function refreshToken(refreshTok) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: refreshTok,
      grant_type: 'refresh_token',
    }).toString();

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body).access_token);
        } else {
          reject(new Error(`토큰 갱신 실패: ${res.statusCode} ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// GCS CORS 설정 (JSON API)
function setCors(accessToken, bucketName = BUCKET_NAME) {
  return new Promise((resolve, reject) => {
    const corsConfig = {
      cors: [
        {
          origin: ['*'],
          method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
          maxAgeSeconds: 3600,
          responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        },
      ],
    };
    const body = JSON.stringify(corsConfig);

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b/${bucketName}?fields=cors`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`CORS 설정 실패: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 버킷 목록 조회
function listBuckets(accessToken, projectId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b?project=${projectId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`버킷 목록 조회 실패: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('Firebase CLI 인증 토큰 확인...');
    const tokens = getFirebaseToken();

    console.log('토큰 갱신 중...');
    const accessToken = await refreshToken(tokens.refresh_token);

    // 먼저 버킷 목록 확인
    console.log('버킷 목록 조회 중...');
    const buckets = await listBuckets(accessToken, 'ijw-calander');
    console.log('사용 가능한 버킷:', buckets.items?.map(b => b.name) || 'none');

    // 일치하는 버킷 찾기
    const bucket = buckets.items?.find(b => b.name.includes('ijw-calander'));
    const bucketName = bucket ? bucket.name : BUCKET_NAME;

    console.log(`\nCORS 설정 적용 중... (버킷: ${bucketName})`);
    const result = await setCors(accessToken, bucketName);

    console.log('\nCORS 설정 완료!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('오류:', error.message);
  }
}

main();
