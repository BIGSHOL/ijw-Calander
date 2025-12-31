import { TuitionEntry } from "../types";

const SHEET_ID = '1G9zJHXbp2QxIQ9SigSJ-_E1-VNBATwXxm_0pSvzyrHc';
const SHEET_NAME = '[데이터 시트]';
const QUERY = 'SELECT A, B, D';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&tq=${encodeURIComponent(QUERY)}`;

const parseCSV = (text: string) => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell);
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }
    return rows;
};

export const fetchSheetData = async (): Promise<TuitionEntry[]> => {
    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();

        if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
            throw new Error('시트 데이터를 읽을 수 없습니다.');
        }

        if (!response.ok) {
            throw new Error('네트워크 응답 오류가 발생했습니다.');
        }

        const rows = parseCSV(text);
        const entries: TuitionEntry[] = [];

        rows.forEach((row, index) => {
            if (row.length === 0 || (row.length === 1 && !row[0])) return;

            const academyName = row[0]?.trim() || '';
            const feeString = row[1]?.toString() || '0';
            const cleanFeeString = feeString.replace(/[^0-9]/g, '');
            const projectedFee = cleanFeeString === '' ? 0 : parseInt(cleanFeeString, 10);
            const reason = row[2]?.trim() || '';

            if (index === 0 && cleanFeeString === '' && (feeString.includes('수강료') || feeString.includes('금액'))) {
                return;
            }

            if (!academyName && projectedFee === 0) return;

            let category: 'increase' | 'decrease' | 'steady' = 'steady';
            if (reason.includes('증가') || reason.includes('인상') || reason.includes('신규')) category = 'increase';
            else if (reason.includes('감소') || reason.includes('환불') || reason.includes('종강')) category = 'decrease';

            entries.push({
                id: crypto.randomUUID(),
                academyName,
                projectedFee,
                reason,
                category
            });
        });

        return entries;
    } catch (error) {
        console.error("Sheet Fetch Error:", error);
        throw error;
    }
};
