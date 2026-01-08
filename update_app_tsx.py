#!/usr/bin/env python3
"""
App.tsx에 학생 관리 탭을 추가하는 스크립트
"""

def update_app_tsx():
    file_path = r'd:\ijw-calander\App.tsx'

    # 파일 읽기
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 수정할 내용
    modified = False
    new_lines = []

    for i, line in enumerate(lines):
        # 1. import 섹션에 StudentManagementTab 추가 (line 18 뒤)
        if 'import ConsultationManager' in line and not modified:
            new_lines.append(line)
            new_lines.append("import StudentManagementTab from './components/StudentManagement/StudentManagementTab';\n")
            modified = True
            continue

        # 2. appMode 타입에 'students' 추가 (line 42)
        if "const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | null>(null);" in line:
            new_lines.append("  const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | null>(null);\n")
            continue

        # 3. priority 배열에 'students' 추가 (line 204 근처)
        if "const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation'];" in line:
            new_lines.append("    const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation' | 'students')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];\n")
            continue

        # 4. preferredTab 타입 캐스팅에 'students' 추가 (line 213 근처)
        if "setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance');" in line:
            new_lines.append("        setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students');\n")
            continue

        # 5. 상담 관리 버튼 뒤에 학생 관리 버튼 추가 (line 1269 근처)
        if '📝 상담 관리' in line:
            new_lines.append(line)
            # 다음 3줄 추가 (</button>, )}, </div> 닫기 전까지)
            for j in range(i+1, min(i+4, len(lines))):
                new_lines.append(lines[j])
            # 학생 관리 버튼 추가
            new_lines.append("              {/* Student Management */}\n")
            new_lines.append("              {canAccessTab('students' as AppTab) && (\n")
            new_lines.append("                <button\n")
            new_lines.append("                  onClick={() => setAppMode('students')}\n")
            new_lines.append("                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${\n")
            new_lines.append("                    appMode === 'students'\n")
            new_lines.append("                      ? 'bg-[#fdb813] text-[#081429] shadow-sm'\n")
            new_lines.append("                      : 'text-gray-400 hover:text-white hover:bg-white/5'\n")
            new_lines.append("                  }`}\n")
            new_lines.append("                >\n")
            new_lines.append("                  👥 학생 관리\n")
            new_lines.append("                </button>\n")
            new_lines.append("              )}\n")
            # 다음 3줄 건너뛰기
            for _ in range(3):
                i += 1
            continue

        # 6. attendance 뷰 뒤에 students 뷰 추가 (line 1804 근처)
        if "        ) : appMode === 'attendance' ?" in line:
            new_lines.append(line)
            # 다음 4줄 추가 (AttendanceManager 블록)
            for j in range(i+1, min(i+5, len(lines))):
                new_lines.append(lines[j])
            # students 뷰 추가
            new_lines.append("        ) : appMode === 'students' ? (\n")
            new_lines.append("          /* Student Management View */\n")
            new_lines.append("          <div className=\"w-full flex-1 overflow-hidden\">\n")
            new_lines.append("            <StudentManagementTab />\n")
            new_lines.append("          </div>\n")
            # 다음 4줄 건너뛰기
            for _ in range(4):
                i += 1
            continue

        new_lines.append(line)

    # 파일 쓰기
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print("✅ App.tsx 수정 완료!")
    print("추가된 내용:")
    print("  1. StudentManagementTab import")
    print("  2. appMode 타입에 'students' 추가")
    print("  3. 상단 네비게이션에 '👥 학생 관리' 버튼 추가")
    print("  4. students 뷰 렌더링 로직 추가")

if __name__ == '__main__':
    update_app_tsx()
