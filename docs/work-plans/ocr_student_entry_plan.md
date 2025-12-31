# Implementation Plan - Image-based Student Entry (OCR)

To speed up student data entry, we will implement client-side OCR using `tesseract.js` to parse student lists from images (screenshots/photos) directly in the "Student Management" modal.

## User Review Required
> [!NOTE]
> Client-side OCR (Tesseract.js) requires downloading language data (~20MB) on the first run. Subsequent runs will use the cache. It might be slightly slow on the very first attempt.

---

## Phase 1: UI Setup (StudentModal.tsx)

### 1.1 Add Dependencies
```bash
npm install tesseract.js
```

### 1.2 Import Tesseract
Add to top of `StudentModal.tsx`:
```typescript
import Tesseract from 'tesseract.js';
import { Upload, ImagePlus, Loader2 } from 'lucide-react';
```

### 1.3 Add State Variables
Add after existing state declarations (around line 50):
```typescript
// OCR State
const [ocrImage, setOcrImage] = useState<string | null>(null);
const [isScanning, setIsScanning] = useState(false);
const [ocrResults, setOcrResults] = useState<Array<{
    name: string;
    englishName: string;
    school: string;
    grade: string;
    confidence: number;
    selected: boolean;
}>>([]);
const [showOcrSection, setShowOcrSection] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

### 1.4 Insert OCR Section in JSX
Insert **before** the "Manual Input Form" section (around line 401):
```tsx
{/* OCR Smart Add Section */}
<div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
    <button
        onClick={() => setShowOcrSection(!showOcrSection)}
        className="w-full flex items-center justify-between text-sm font-bold text-indigo-700 hover:text-indigo-900"
    >
        <span className="flex items-center gap-2">
            <ImagePlus size={16} />
            스마트 명단 입력 (이미지/붙여넣기)
        </span>
        <span className="text-xs text-gray-500">
            {showOcrSection ? '접기' : '펼치기'}
        </span>
    </button>

    {showOcrSection && (
        <div className="mt-3 space-y-3">
            {/* Upload/Paste Area */}
            <div className="flex gap-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="flex-1 px-3 py-2 bg-white border-2 border-dashed border-indigo-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-xs font-bold text-indigo-600 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Upload size={14} />
                    이미지 선택
                </button>
                <button
                    onClick={handlePasteFromClipboard}
                    disabled={isScanning}
                    className="flex-1 px-3 py-2 bg-white border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-xs font-bold text-purple-600 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <ImagePlus size={14} />
                    붙여넣기 (Ctrl+V)
                </button>
            </div>

            {/* Image Preview */}
            {ocrImage && (
                <div className="relative">
                    <img
                        src={ocrImage}
                        alt="OCR Preview"
                        className="w-full max-h-40 object-contain border border-gray-300 rounded bg-white"
                    />
                    <button
                        onClick={() => {
                            setOcrImage(null);
                            setOcrResults([]);
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Scanning Status */}
            {isScanning && (
                <div className="flex items-center justify-center gap-2 py-4 text-indigo-600">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-bold">이미지 분석 중...</span>
                </div>
            )}

            {/* OCR Results Table */}
            {ocrResults.length > 0 && !isScanning && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">
                            인식된 학생 ({ocrResults.filter(r => r.selected).length}/{ocrResults.length})
                        </span>
                        <button
                            onClick={() => {
                                setOcrResults(prev => prev.map(r => ({ ...r, selected: !prev.every(x => x.selected) })));
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                        >
                            전체 {ocrResults.every(r => r.selected) ? '해제' : '선택'}
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="p-1 w-6"></th>
                                    <th className="p-1 text-left">이름</th>
                                    <th className="p-1 text-left">영어</th>
                                    <th className="p-1 text-left">학교</th>
                                    <th className="p-1 text-center w-10">학년</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ocrResults.map((result, idx) => (
                                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={result.selected}
                                                onChange={() => {
                                                    setOcrResults(prev => prev.map((r, i) =>
                                                        i === idx ? { ...r, selected: !r.selected } : r
                                                    ));
                                                }}
                                                className="w-3 h-3"
                                            />
                                        </td>
                                        <td className="p-1">
                                            <input
                                                value={result.name}
                                                onChange={(e) => {
                                                    setOcrResults(prev => prev.map((r, i) =>
                                                        i === idx ? { ...r, name: e.target.value } : r
                                                    ));
                                                }}
                                                className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                        <td className="p-1">
                                            <input
                                                value={result.englishName}
                                                onChange={(e) => {
                                                    setOcrResults(prev => prev.map((r, i) =>
                                                        i === idx ? { ...r, englishName: e.target.value } : r
                                                    ));
                                                }}
                                                className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                        <td className="p-1">
                                            <input
                                                value={result.school}
                                                onChange={(e) => {
                                                    setOcrResults(prev => prev.map((r, i) =>
                                                        i === idx ? { ...r, school: e.target.value } : r
                                                    ));
                                                }}
                                                className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                        <td className="p-1">
                                            <input
                                                value={result.grade}
                                                onChange={(e) => {
                                                    setOcrResults(prev => prev.map((r, i) =>
                                                        i === idx ? { ...r, grade: e.target.value } : r
                                                    ));
                                                }}
                                                className="w-full px-1 py-0.5 border border-gray-200 rounded text-center text-xs"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={handleBulkAddFromOCR}
                        disabled={ocrResults.filter(r => r.selected).length === 0}
                        className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        선택한 학생 추가 ({ocrResults.filter(r => r.selected).length}명)
                    </button>
                </div>
            )}
        </div>
    )}
</div>
```

---

## Phase 2: OCR Integration

### 2.1 Image Upload Handler
Add before the `return` statement (around line 362):
```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const imageData = event.target?.result as string;
        setOcrImage(imageData);
        await runOCR(imageData);
    };
    reader.readAsDataURL(file);
};
```

### 2.2 Clipboard Paste Handler
```typescript
const handlePasteFromClipboard = async () => {
    try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const imageData = event.target?.result as string;
                        setOcrImage(imageData);
                        await runOCR(imageData);
                    };
                    reader.readAsDataURL(blob);
                    return;
                }
            }
        }
        alert('클립보드에 이미지가 없습니다.\n스크린샷을 찍은 후 다시 시도해주세요.');
    } catch (error) {
        console.error('Clipboard access error:', error);
        alert('클립보드 접근 실패.\n브라우저 설정에서 클립보드 권한을 확인해주세요.');
    }
};
```

### 2.3 OCR Execution
```typescript
const runOCR = async (imageData: string) => {
    setIsScanning(true);
    setOcrResults([]);

    try {
        const result = await Tesseract.recognize(
            imageData,
            'kor+eng', // Korean + English
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );

        const text = result.data.text;
        console.log('OCR Raw Text:', text);

        const parsedStudents = parseOCRText(text);
        setOcrResults(parsedStudents.map(s => ({ ...s, selected: true })));

        if (parsedStudents.length === 0) {
            alert('학생 정보를 인식하지 못했습니다.\n수동으로 수정하거나 다시 시도해주세요.');
        }
    } catch (error) {
        console.error('OCR Error:', error);
        alert('이미지 분석 중 오류가 발생했습니다.');
    } finally {
        setIsScanning(false);
    }
};
```

---

## Phase 3: Text Parsing

### 3.1 Korean Student Data Parser
```typescript
const parseOCRText = (text: string): Array<{
    name: string;
    englishName: string;
    school: string;
    grade: string;
    confidence: number;
}> => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const students: Array<{
        name: string;
        englishName: string;
        school: string;
        grade: string;
        confidence: number;
    }> = [];

    for (const line of lines) {
        // Pattern 1: 강민승(Willy) 달성초3
        // Pattern 2: 강민승 (Willy) 달성초 3학년
        // Pattern 3: 강민승 달성초3
        // Pattern 4: 강민승(Willy)

        // Regex explanation:
        // ([가-힣]{2,4}) - Korean name (2-4 chars)
        // (?:\s*\(([a-zA-Z\s]+)\))? - Optional English name in parentheses
        // (?:\s*([가-힣]+(?:초|중|고)?(?:등학교)?))?? - Optional school name
        // (?:\s*(\d+)(?:학년)?)? - Optional grade number

        const pattern = /([가-힣]{2,4})(?:\s*\(([a-zA-Z\s]+)\))?(?:\s*([가-힣]+(?:초|중|고)?(?:등학교)?))?\s*(\d+)?(?:학년)?/g;

        let match;
        while ((match = pattern.exec(line)) !== null) {
            const [, name, englishName, school, grade] = match;

            // Only add if we have at least a name
            if (name && name.length >= 2) {
                students.push({
                    name: name.trim(),
                    englishName: englishName?.trim() || '',
                    school: school?.trim() || '',
                    grade: grade?.trim() || '',
                    confidence: 0.8 // Placeholder
                });
            }
        }
    }

    // Deduplicate by name
    const uniqueStudents = students.filter((student, index, self) =>
        index === self.findIndex((s) => s.name === student.name)
    );

    return uniqueStudents;
};
```

### 3.2 Bulk Add Handler
```typescript
const handleBulkAddFromOCR = async () => {
    const selectedStudents = ocrResults.filter(r => r.selected);

    if (selectedStudents.length === 0) {
        alert('추가할 학생을 선택해주세요.');
        return;
    }

    // Add each selected student
    for (const student of selectedStudents) {
        await handleAddStudent(
            student.name,
            student.englishName,
            student.grade,
            student.school
        );
    }

    // Clear OCR state
    setOcrImage(null);
    setOcrResults([]);
    setShowOcrSection(false);

    alert(`${selectedStudents.length}명의 학생이 추가되었습니다.\n저장 버튼을 눌러야 반영됩니다.`);
};
```

---

## 테스트 데이터

### 예제 이미지 텍스트

**예제 1: 표준 형식**
```
강민승(Willy) 달성초3
김지우(Emma) 동성초4
박서준 범어초5
이하은(Sophia) 대명초3학년
```

**예제 2: 다양한 형식**
```
1. 강민승 (Willy) 달성초등학교 3학년
2. 김지우 동성초 4
3. 박서준(Jason)
4. 이하은 대명중 2학년
```

**예제 3: 노이즈 포함**
```
[학생 명단]
- 강민승(Willy) 달성초3
- 김지우(Emma) 동성초4
총 2명
```

### 테스트 절차

1. **스크린샷 테스트**
   - 위 텍스트를 메모장에 복사
   - Win+Shift+S로 스크린샷
   - StudentModal 열고 "붙여넣기" 버튼 클릭

2. **이미지 파일 테스트**
   - 위 텍스트를 이미지로 저장
   - "이미지 선택" 버튼으로 업로드

3. **수동 수정 테스트**
   - OCR 결과 표에서 잘못 인식된 항목 수정
   - 체크박스로 필요한 항목만 선택
   - "선택한 학생 추가" 클릭

4. **검증**
   - 학생 목록에 정확히 추가되었는지 확인
   - 저장 버튼 눌러 Firestore에 반영
   - 새로고침 후 데이터 유지 확인

---

## 트러블슈팅

### 문제 1: OCR이 한글을 인식하지 못함
**증상**: 영어는 인식하지만 한글 이름이 깨지거나 누락됨
**원인**: Tesseract 언어 데이터 미다운로드 또는 잘못된 설정
**해결**:
```typescript
// runOCR 함수에서 언어 설정 확인
const result = await Tesseract.recognize(
    imageData,
    'kor+eng', // 순서 중요: kor을 먼저
    // ...
);
```

### 문제 2: 첫 실행 시 매우 느림
**증상**: 첫 OCR 실행 시 20-30초 소요
**원인**: Tesseract 언어 데이터 다운로드 (~20MB)
**해결**:
- 정상 동작. 두 번째 실행부터는 캐시 사용으로 빨라짐
- 로딩 상태 표시로 사용자에게 안내:
```typescript
{isScanning && (
    <div className="text-xs text-gray-500 mt-1">
        처음 사용 시 언어 데이터 다운로드로 시간이 걸릴 수 있습니다.
    </div>
)}
```

### 문제 3: 인식률이 낮음
**증상**: 텍스트가 명확한데도 잘못 인식됨
**원인**:
- 이미지 해상도 낮음
- 폰트가 복잡하거나 손글씨
- 배경이 복잡함

**해결**:
1. **이미지 전처리 추가**:
```typescript
const preprocessImage = async (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;

            // Increase contrast
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Contrast enhancement
            const factor = 1.5;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, factor * (data[i] - 128) + 128);
                data[i+1] = Math.min(255, factor * (data[i+1] - 128) + 128);
                data[i+2] = Math.min(255, factor * (data[i+2] - 128) + 128);
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.src = imageData;
    });
};

// runOCR에서 사용
const preprocessed = await preprocessImage(imageData);
const result = await Tesseract.recognize(preprocessed, 'kor+eng', {...});
```

2. **OCR 설정 조정**:
```typescript
const result = await Tesseract.recognize(
    imageData,
    'kor+eng',
    {
        logger: m => console.log(m),
        // PSM (Page Segmentation Mode)
        // 6 = 단일 블록 텍스트 (기본값)
        // 3 = 완전 자동 페이지 분할
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    }
);
```

### 문제 4: 괄호 안 영어 이름이 잘못 파싱됨
**증상**: "강민승(Willy)" → 이름: "강민승Willy", 영어: ""
**원인**: Regex 패턴 오류
**해결**: parseOCRText 함수의 정규식 검증
```typescript
// 테스트 코드
const testCases = [
    { input: "강민승(Willy) 달성초3", expected: { name: "강민승", englishName: "Willy" } },
    { input: "김지우 동성초4", expected: { name: "김지우", englishName: "" } },
];

testCases.forEach(tc => {
    const result = parseOCRText(tc.input);
    console.assert(result[0].name === tc.expected.name, `Failed: ${tc.input}`);
});
```

### 문제 5: 클립보드 접근 권한 오류
**증상**: "클립보드 접근 실패" 알림
**원인**: 브라우저 권한 부족 또는 HTTPS 미사용
**해결**:
- HTTPS 환경에서 실행 (localhost는 예외)
- Chrome: `chrome://settings/content/clipboard` 에서 권한 확인
- 대체 방법: 파일 업로드 사용

### 문제 6: 중복 학생 추가됨
**증상**: 같은 학생이 여러 번 인식됨
**원인**: OCR이 같은 줄을 여러 번 인식
**해결**: parseOCRText에 이미 중복 제거 로직 포함됨
```typescript
// Deduplicate by name
const uniqueStudents = students.filter((student, index, self) =>
    index === self.findIndex((s) => s.name === student.name)
);
```

### 문제 7: 학년 숫자만 추출됨 (초/중/고 구분 안됨)
**증상**: "달성초3" → 학교: "달성초", 학년: "3" (O)
        "대명중2학년" → 학교: "", 학년: "2" (X)
**원인**: Regex 그룹 캡처 순서 문제
**해결**: 현재 패턴은 학교명 캡처를 지원. 학교-학년 분리 로직 개선:
```typescript
// 학교명에서 숫자 분리
let finalSchool = school?.trim() || '';
let finalGrade = grade?.trim() || '';

// "달성초3" → school: "달성초", grade: "3"
if (!finalGrade && finalSchool) {
    const match = finalSchool.match(/^([가-힣]+(?:초|중|고)?(?:등학교)?)(\d+)?$/);
    if (match) {
        finalSchool = match[1];
        finalGrade = match[2] || '';
    }
}
```

---

## Verification Plan

### Automated Tests
- Not applicable for OCR accuracy (visual verification required).

### Manual Verification
1. **Paste Test**: Screenshot a row from the provided example `강민승(Willy) 달성초3` and paste it.
2. **Recognition**: Verify it parses into Name: 강민승, Eng: Willy, School: 달성초, Grade: 3.
3. **Correction**: Verify users can manually edit the OCR result before adding.
4. **Bulk Add**: Verify clicking "Add Selected" adds them to the local student list.
5. **Save**: Click "저장" button and verify Firestore updates correctly.
6. **Edge Cases**: Test with noisy images, mixed formats, and partial data.

---

## Performance Optimization

### Lazy Loading Tesseract
Only load Tesseract when user opens the OCR section:
```typescript
const [tesseractLoaded, setTesseractLoaded] = useState(false);

useEffect(() => {
    if (showOcrSection && !tesseractLoaded) {
        // Tesseract is already imported, but you can add pre-warming here
        Tesseract.createWorker().then(() => {
            setTesseractLoaded(true);
        });
    }
}, [showOcrSection]);
```

### Web Worker Support
Tesseract.js already uses Web Workers internally. No additional setup needed.

---

## Future Enhancements

1. **Multiple Image Upload**: Process multiple screenshots at once
2. **Camera Integration**: Use device camera to scan physical documents
3. **Template Matching**: Pre-defined formats for common student list layouts
4. **Confidence Scoring**: Highlight low-confidence results for manual review
5. **Export/Import**: Save OCR results as CSV for external editing
