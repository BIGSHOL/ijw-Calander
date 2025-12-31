import { GoogleGenAI } from "@google/genai";
import { TuitionEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export const generateReportInsight = async (entries: TuitionEntry[]) => {
    if (entries.length === 0) return "데이터가 없습니다.";

    const dataContext = JSON.stringify(entries.map(e => ({
        academy: e.academyName,
        fee: e.projectedFee,
        reason: e.reason
    })));

    const prompt = `
    당신은 학원 사업 재무 분석가입니다. 아래는 다음 달 학원별 예상 수강료 데이터입니다.
    데이터: ${dataContext}
    
    이 데이터를 바탕으로 경영진에게 보고할 간단한 요약 보고서를 마크다운 형식으로 작성해주세요.
    
    다음 내용을 포함해야 합니다:
    1. **전체 요약**: 총 예상 매출액과 전반적인 분위기.
    2. **주요 사항**: 매출 기여도가 높은 상위 2개 학원 언급.
    3. **증감 분석**: 사유(reason)를 분석하여 매출 증가/감소의 주요 원인 패턴 파악.
    4. **제언**: 경영진을 위한 한 줄 제언.

    톤앤매너: 전문적이고 간결하게. 금액은 한국 원화(KRW) 형식을 따르세요.
  `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "보고서를 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
};
