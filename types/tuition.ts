// 수강료 계산기 타입 정의

export enum TuitionSubjectType {
  ENGLISH = 'EIE',
  MATH = '수학',
  KOREAN = '국어',
  ENGLISH_SUB = '영어',
  OTHER = '기타',
}

export interface TuitionCourse {
  id: string;
  category: TuitionSubjectType;
  name: string;
  days: string;
  defaultPrice: number;
}

export interface TuitionSelectedCourse extends TuitionCourse {
  uid: string;
  sessions: number;
  price: number;
  note: string;
  excludeHolidays?: boolean;
  useSessionPeriod?: boolean;
}

export interface TuitionExtraItem {
  id: string;
  category: 'textbook' | 'bus' | 'system' | 'care' | 'test' | 'other';
  name: string;
  defaultPrice: number;
}

export interface TuitionSelectedExtra extends TuitionExtraItem {
  uid: string;
  price: number;
  note: string;
}

export interface TuitionStudentInfo {
  name: string;
  school: string;
  grade: string;
  startDate: string;
  endDate: string;
  consultant: string;
}

export interface TuitionDiscountItem {
  id: string;
  name: string;
  amount: number;
}

export interface TuitionSelectedDiscount extends TuitionDiscountItem {
  uid: string;
}

export interface TuitionSavedInvoice {
  id: string;
  studentInfo: TuitionStudentInfo;
  courses: TuitionSelectedCourse[];
  extras: TuitionSelectedExtra[];
  discounts: TuitionSelectedDiscount[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TuitionDateRange {
  startDate: string;
  endDate: string;
}

export interface TuitionSessionPeriod {
  id: string;
  year: number;
  category: string;
  month: number;
  ranges: TuitionDateRange[];
  sessions: number;
}

export interface TuitionHoliday {
  id: string;
  date: string;
  name: string;
  year: number;
}

export type TuitionAppMode = 'calculator' | 'manage' | 'invoiceList';
export type TuitionManageTab = 'courses' | 'extras' | 'discounts' | 'holidays' | 'sessions';
