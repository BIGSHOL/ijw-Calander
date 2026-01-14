// 브라우저 콘솔에 붙여넣기 - 디버깅용

console.log('=== 데이터 구조 설정 확인 ===');
console.log('useNewDataStructure:', localStorage.getItem('useNewDataStructure'));

// 강제로 새 구조 활성화
localStorage.setItem('useNewDataStructure', 'true');
console.log('✅ 새 구조로 설정 완료');
console.log('새 설정값:', localStorage.getItem('useNewDataStructure'));

console.log('\n페이지를 새로고침(F5)하세요!');
