/**
 * Form data structure for creating/editing departments
 * @module types/departmentForm
 */

import { PermissionLevel } from '../constants/permissions';

/**
 * New department form state
 * @description
 * Encapsulates all fields needed to create a new department
 */
export interface NewDepartmentForm {
  name: string;
  category: string;
  defaultColor: string;
  defaultTextColor: string;
  defaultBorderColor: string;
  defaultPermission: PermissionLevel;
}

/**
 * Initial state for new department form
 */
export const INITIAL_DEPARTMENT_FORM: NewDepartmentForm = {
  name: '',
  category: '',
  defaultColor: '#ffffff',
  defaultTextColor: '#000000',
  defaultBorderColor: '#fee2e2',
  defaultPermission: 'view',
};

/**
 * Category management state
 */
export interface CategoryManagementState {
  newCategoryName: string;
}

/**
 * Department search/filter state
 */
export interface DepartmentFilterState {
  searchTerm: string;
  isCreating: boolean;
  draggedIndex: number | null;
}
