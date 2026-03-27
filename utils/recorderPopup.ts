/**
 * 녹음 팝업 창 관리 유틸리티
 * 별도 창에서 녹음을 수행하여 메인 앱의 새로고침/배포 영향을 받지 않음
 *
 * 흐름:
 * 1. 메인 창에서 openRecorderPopup() 호출 → about:blank 팝업 생성
 * 2. 팝업이 'recorder-ready' 전송 → 메인 창이 'start' 응답
 * 3. 팝업이 자동으로 녹음 시작
 * 4. 메인 창이 AssemblyAI 토큰 발급 후 'token' 전송 → 팝업이 실시간 전사 연결
 * 5. 녹음 완료 시 팝업이 'recording-complete' + ArrayBuffer 전송
 * 6. 메인 창에서 File 객체로 변환하여 기존 업로드 플로우 이어감
 */

const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 620;

export interface RecorderPopupCallbacks {
  onComplete: (file: File, duration: number, transcriptPreview: string[]) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/**
 * 녹음 팝업 창을 열고 녹음 완료 시 콜백 호출
 * @returns true: 팝업 열림, false: 팝업 차단됨 (인라인 녹음으로 fallback 필요)
 */
export function openRecorderPopup(
  title: string,
  callbacks: RecorderPopupCallbacks,
  getAssemblyToken?: () => Promise<string | null>,
): boolean {
  const left = Math.round((screen.width - POPUP_WIDTH) / 2);
  const top = Math.round((screen.height - POPUP_HEIGHT) / 2);

  const popup = window.open(
    'about:blank',
    `recorder_${Date.now()}`,
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes`
  );

  if (!popup) return false;

  const origin = window.location.origin;
  let completed = false;

  popup.document.write(generateRecorderHTML(title));
  popup.document.close();

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== popup) return;
    const { data } = event;

    switch (data.type) {
      case 'recorder-ready':
        popup.postMessage({ type: 'start' }, origin);
        // 토큰 비동기 발급 (녹음은 먼저 시작됨)
        if (getAssemblyToken) {
          getAssemblyToken().then(token => {
            if (token && !popup.closed) {
              popup.postMessage({ type: 'token', token }, origin);
            }
          }).catch(() => {});
        }
        break;

      case 'recording-complete': {
        completed = true;
        const { arrayBuffer, mimeType, fileName, duration, transcriptPreview } = data;
        if (arrayBuffer && mimeType && fileName) {
          const blob = new Blob([arrayBuffer], { type: mimeType });
          const file = new File([blob], fileName, { type: mimeType });
          callbacks.onComplete(file, duration || 0, transcriptPreview || []);
        }
        break;
      }

      case 'recording-error':
        callbacks.onError(data.message || '녹음 중 오류가 발생했습니다.');
        break;
    }
  };

  window.addEventListener('message', handleMessage);

  // 팝업 닫힘 감지
  const pollClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollClosed);
      window.removeEventListener('message', handleMessage);
      if (!completed) callbacks.onClose();
    }
  }, 500);

  return true;
}

// --------------- 팝업 HTML 생성 ---------------

function generateRecorderHTML(title: string): string {
  // HTML 이스케이프
  const safeTitle = title.replace(/[<>&"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c)
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:24px;color:#1a1a1a}
.header{text-align:center;margin-bottom:24px}
.header h1{font-size:17px;font-weight:600;color:#081429}
.header p{font-size:12px;color:#6b7280;margin-top:4px}
.timer{font-size:48px;font-family:'SF Mono',Consolas,monospace;font-weight:300;color:#374151;margin:12px 0;transition:color .3s}
.timer.rec{color:#ef4444}
.rec-btn{width:80px;height:80px;border-radius:50%;border:3px solid #d1d5db;background:#f3f4f6;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;margin:12px 0;outline:none}
.rec-btn:hover{border-color:#9ca3af;background:#e5e7eb}
.rec-btn.rec{border-color:#fca5a5;background:#fef2f2;animation:pulse 2s infinite}
.rec-btn:disabled{opacity:.5;cursor:not-allowed;animation:none}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.9}}
.stop-shape{width:24px;height:24px;background:#ef4444;border-radius:4px}
.status{font-size:13px;color:#6b7280;margin:6px 0;min-height:20px}
.transcript{width:100%;max-width:380px;margin-top:20px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;flex:1;overflow-y:auto;max-height:260px;display:none}
.t-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.t-dot{width:8px;height:8px;border-radius:50%;background:#d1d5db;flex-shrink:0}
.t-dot.on{background:#22c55e;animation:pulse 1.5s infinite}
.t-dot.wait{background:#eab308;animation:pulse 1.5s infinite}
.t-dot.err{background:#ef4444}
.t-label{font-size:12px;font-weight:500;color:#6b7280}
.t-text{font-size:13px;line-height:1.6;color:#374151;white-space:pre-wrap}
.t-text .dim{color:#9ca3af}
.t-text .ph{color:#d1d5db}
.warn{margin-top:16px;padding:8px 12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;font-size:12px;color:#854d0e;text-align:center;width:100%;max-width:380px;display:none}
.done{text-align:center;margin-top:24px;display:none}
.done .chk{width:48px;height:48px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
.done p{font-size:14px;color:#374151}
.done .sub{font-size:12px;color:#9ca3af;margin-top:4px}
.err-msg{margin-top:12px;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:13px;color:#dc2626;text-align:center;width:100%;max-width:380px;display:none}
</style>
</head>
<body>
<div class="header">
  <h1>${safeTitle}</h1>
  <p>이 창을 열어둔 채 메인 화면을 자유롭게 사용하세요</p>
</div>
<div class="timer" id="tmr">00:00</div>
<button class="rec-btn" id="btn" disabled>
  <svg id="mic" width="28" height="28" viewBox="0 0 24 24" fill="#6b7280" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/>
  </svg>
  <div class="stop-shape" id="stp" style="display:none"></div>
</button>
<p class="status" id="sts">준비 중...</p>
<div class="err-msg" id="errMsg"></div>
<div class="warn" id="wrn">녹음 중에는 이 창을 닫지 마세요</div>
<div class="transcript" id="tbox">
  <div class="t-head">
    <div class="t-dot" id="tdot"></div>
    <span class="t-label" id="tlab">실시간 전사</span>
  </div>
  <div class="t-text" id="ttxt"><span class="ph">말씀하시면 여기에 텍스트가 표시됩니다...</span></div>
</div>
<div class="done" id="done">
  <div class="chk">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
  <p>녹음이 완료되었습니다</p>
  <p class="sub" id="doneInfo"></p>
  <p class="sub">이 창은 자동으로 닫힙니다...</p>
</div>

<script>
(function(){
  var recording=false, mr=null, chunks=[], sec=0, ti=null, mime='';
  var ws=null, actx=null, proc=null, src=null, txts=[], interim='';
  var $=function(id){return document.getElementById(id)};
  var tmr=$('tmr'),btn=$('btn'),mic=$('mic'),stp=$('stp'),sts=$('sts');
  var tbox=$('tbox'),tdot=$('tdot'),tlab=$('tlab'),ttxt=$('ttxt');
  var wrn=$('wrn'),done=$('done'),doneInfo=$('doneInfo'),errMsg=$('errMsg');
  var origin=window.opener?window.location.origin:'*';

  function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}

  function updTxt(){
    var h=txts.join(' ');
    if(interim) h+=(txts.length?' ':'')+('<span class="dim">'+interim+'</span>');
    if(!h&&recording) h='<span class="ph">말씀하시면 여기에 텍스트가 표시됩니다...</span>';
    ttxt.innerHTML=h;
    tbox.scrollTop=tbox.scrollHeight;
  }

  function showErr(msg){errMsg.textContent=msg;errMsg.style.display='block'}

  // AssemblyAI 전사 연결
  function connectStt(token,stream){
    tdot.className='t-dot wait';tlab.textContent='음성인식 연결 중...';
    try{
      var p=new URLSearchParams({sample_rate:'16000',speech_model:'universal-streaming-multilingual',token:token});
      ws=new WebSocket('wss://streaming.assemblyai.com/v3/ws?'+p);
      ws.binaryType='arraybuffer';
      ws.onopen=function(){tdot.className='t-dot on';tlab.textContent='실시간 전사 (미리보기)'};
      ws.onmessage=function(ev){
        try{var m=JSON.parse(ev.data);if(m.type==='Turn'){if(m.end_of_turn&&m.transcript){txts.push(m.transcript);interim=''}else if(!m.end_of_turn&&m.transcript){interim=m.transcript}updTxt()}}catch(e){}
      };
      ws.onerror=function(){tdot.className='t-dot err';tlab.textContent='음성인식 미지원 — 녹음은 정상 진행 중'};
      ws.onclose=function(){if(!recording){tdot.className='t-dot'}};

      actx=new AudioContext({sampleRate:16000});
      src=actx.createMediaStreamSource(stream);
      proc=actx.createScriptProcessor(4096,1,1);
      proc.onaudioprocess=function(e){
        if(!ws||ws.readyState!==WebSocket.OPEN)return;
        var inp=e.inputBuffer.getChannelData(0),pcm=new Int16Array(inp.length);
        for(var i=0;i<inp.length;i++){var s=Math.max(-1,Math.min(1,inp[i]));pcm[i]=s<0?s*0x8000:s*0x7FFF}
        ws.send(pcm.buffer);
      };
      src.connect(proc);proc.connect(actx.destination);
    }catch(e){tdot.className='t-dot err';tlab.textContent='음성인식 초기화 실패'}
  }

  function stopStt(){
    if(ws&&ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify({type:'Terminate'}))}catch(e){}ws.close()}ws=null;
    if(proc){proc.disconnect();proc=null}if(src){src.disconnect();src=null}if(actx){actx.close();actx=null}
  }

  var pendingStream=null;

  function start(){
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      pendingStream=stream;
      chunks=[];txts=[];interim='';sec=0;
      mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':
           MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm';
      mr=new MediaRecorder(stream,{mimeType:mime});
      mr.ondataavailable=function(e){if(e.data.size>0)chunks.push(e.data)};
      mr.onerror=function(){
        showErr('녹음 중 오류가 발생했습니다.');
        if(window.opener)window.opener.postMessage({type:'recording-error',message:'녹음 중 오류가 발생했습니다.'},origin);
        cleanup();
      };
      mr.onstop=function(){
        stream.getTracks().forEach(function(t){t.stop()});
        var blob=new Blob(chunks,{type:mime});
        var ext=mime.indexOf('mp4')>-1?'mp4':'webm';
        var d=new Date();
        var ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+
          String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0');
        var fn='녹음_'+ds+'.'+ext;
        blob.arrayBuffer().then(function(ab){
          if(window.opener){
            window.opener.postMessage({type:'recording-complete',arrayBuffer:ab,mimeType:mime,fileName:fn,duration:sec,transcriptPreview:txts},origin,[ab]);
          }
          btn.style.display='none';sts.style.display='none';tmr.style.display='none';wrn.style.display='none';tbox.style.display='none';errMsg.style.display='none';
          done.style.display='block';doneInfo.textContent=fmt(sec)+' · '+(blob.size/1024/1024).toFixed(1)+'MB';
          setTimeout(function(){try{window.close()}catch(e){}},2500);
        });
      };
      mr.start(1000);recording=true;
      btn.classList.add('rec');btn.disabled=false;mic.style.display='none';stp.style.display='block';
      sts.textContent='녹음 중 — 버튼을 눌러 정지';wrn.style.display='block';tbox.style.display='block';tmr.classList.add('rec');
      ti=setInterval(function(){sec++;tmr.textContent=fmt(sec)},1000);
    }).catch(function(){
      sts.textContent='마이크 접근이 거부되었습니다.';btn.disabled=false;
      if(window.opener)window.opener.postMessage({type:'recording-error',message:'마이크 접근이 거부되었습니다. 브라우저 권한을 확인해주세요.'},origin);
    });
  }

  function stop(){
    if(mr&&mr.state==='recording')mr.stop();
    stopStt();recording=false;
    if(ti){clearInterval(ti);ti=null}
    btn.classList.remove('rec');sts.textContent='처리 중...';tmr.classList.remove('rec');
  }

  function cleanup(){
    stopStt();
    if(mr&&mr.state!=='inactive'){try{mr.stream.getTracks().forEach(function(t){t.stop()});mr.stop()}catch(e){}}
    recording=false;if(ti){clearInterval(ti);ti=null}
  }

  btn.onclick=function(){if(recording)stop();else start()};

  window.addEventListener('beforeunload',function(e){if(recording)e.preventDefault()});

  // 메인 창과의 통신
  window.addEventListener('message',function(ev){
    if(ev.data.type==='start'){start()}
    else if(ev.data.type==='token'&&ev.data.token){
      if(pendingStream&&recording)connectStt(ev.data.token,pendingStream);
    }
  });

  // 준비 완료 알림
  if(window.opener){
    window.opener.postMessage({type:'recorder-ready'},origin);
    sts.textContent='녹음을 시작합니다...';
  }else{
    sts.textContent='녹음 버튼을 눌러 시작하세요';btn.disabled=false;
  }
})();
</script>
</body>
</html>`;
}
