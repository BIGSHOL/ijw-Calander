/**
 * Unified Classes Migration Script v2.0
 *
 * Purpose: Migrate english_schedules and 수업목록 to unified classes collection
 * with support for merged classes (합반 수업)
 *
 * Solution: Class Group Field approach
 * - classGroupId: Group identifier for classes taught together
 * - isGroupLeader: Designates the main class in a merged group
 * - groupMembers: Array of class IDs in the group (stored on leader only)
 *
 * Usage:
 *   npm run migrate:classes:v2 -- --dry-run    # Validation only, no writes
 *   npm run migrate:classes:v2                 # Execute migration
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

// Environment variable helper
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

// Initialize Firebase
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================================================
// Type Definitions
// ============================================================================

interface ScheduleSlot {
  day: string;
  periodId: string;
  teacher?: string;
}

interface UnifiedClass {
  id: string;
  className: string;
  subject: 'math' | 'english';
  teacher: string;
  room?: string;
  schedule: ScheduleSlot[];
  color?: string;
  isActive: boolean;

  // Merged class fields
  classGroupId?: string;
  isGroupLeader?: boolean;
  groupMembers?: string[];

  // Legacy compatibility
  legacySchedule?: string[];
  migratedFrom?: 'math' | 'english';
  originalDocId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClassGroup {
  groupId: string;        // e.g., "Ellen-2-화"
  leader: string;         // First class name (e.g., "LT1a")
  members: string[];      // Additional class names (e.g., ["LT1b"])
  teacher: string;
  periodId: string;
  day: string;
  room?: string;
}

interface EnglishScheduleCell {
  className: string;
  room?: string;
  teacher?: string;
  merged?: Array<{ className: string; room?: string }>;
}

interface MathClass {
  id: string;
  className: string;
  teacher: string;
  schedule: string[];
  color?: string;
  [key: string]: any;
}

interface MigrationStats {
  totalClasses: number;
  mathClasses: number;
  englishClasses: number;
  mergedGroups: number;
  singleClasses: number;
  largestGroup: { groupId: string; memberCount: number };
  errors: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 450; // Firestore batch limit is 500

// Collection names
const CLASSES_COLLECTION = 'classes';
const ENGLISH_SCHEDULES_COLLECTION = 'english_schedules';
const MATH_CLASSES_COLLECTION = '수업목록';

// Exclusion patterns
const LAB_CLASS_PATTERN = /LAB/i;

// ============================================================================
// Helper Functions
// ============================================================================

function log(message: string, ...args: any[]) {
  console.log(`[MIGRATE v2] ${message}`, ...args);
}

function error(message: string, ...args: any[]) {
  console.error(`[ERROR] ${message}`, ...args);
}

function parseScheduleString(scheduleStr: string): ScheduleSlot | null {
  // Format: "월 1교시", "화 2교시"
  const match = scheduleStr.match(/^([월화수목금토일])\s*(\d+)교시$/);
  if (!match) return null;

  return {
    day: match[1],
    periodId: match[2],
  };
}

function generateClassId(className: string, teacher: string, subject: 'math' | 'english'): string {
  return `${subject}_${className}_${teacher}`;
}

// ============================================================================
// Phase 1: Identify Merged Class Groups
// ============================================================================

async function identifyMergedGroups(): Promise<Map<string, ClassGroup>> {
  log('Phase 1: Identifying merged class groups from english_schedules...');

  const groupMap = new Map<string, ClassGroup>();
  const teachersSnapshot = await getDocs(collection(db, ENGLISH_SCHEDULES_COLLECTION));

  teachersSnapshot.forEach((teacherDoc) => {
    const teacherName = teacherDoc.id;
    const scheduleData = teacherDoc.data();

    Object.entries(scheduleData).forEach(([key, cellData]) => {
      const cell = cellData as EnglishScheduleCell;

      // Skip LAB classes
      if (LAB_CLASS_PATTERN.test(cell.className)) {
        return;
      }

      // Key format: "teacher-periodId-day" or just "periodId-day"
      let groupKey: string;
      let [part1, part2, part3] = key.split('-');

      if (part3) {
        // Format: "teacher-periodId-day"
        groupKey = key;
      } else {
        // Format: "periodId-day", add teacher
        groupKey = `${teacherName}-${part1}-${part2}`;
      }

      // Collect all class names (main + merged)
      const classNames = [cell.className];
      if (cell.merged && cell.merged.length > 0) {
        classNames.push(...cell.merged.map(m => m.className));
      }

      // Only create group if there are multiple classes
      if (classNames.length > 1) {
        groupMap.set(groupKey, {
          groupId: groupKey,
          leader: classNames[0],
          members: classNames.slice(1),
          teacher: teacherName,
          periodId: part2 || part1,
          day: part3 || part2,
          room: cell.room,
        });
      }
    });
  });

  log(`✅ Found ${groupMap.size} merged class groups`);

  if (DRY_RUN && groupMap.size > 0) {
    log('\n📋 Merged Groups Preview:');
    let count = 0;
    for (const [groupId, group] of groupMap) {
      if (count++ < 5) {
        log(`   ${groupId}: ${group.leader} + [${group.members.join(', ')}]`);
      }
    }
    if (groupMap.size > 5) {
      log(`   ... and ${groupMap.size - 5} more groups`);
    }
  }

  return groupMap;
}

// ============================================================================
// Phase 2: Migrate English Classes with Group Support
// ============================================================================

async function migrateEnglishClasses(groupMap: Map<string, ClassGroup>): Promise<UnifiedClass[]> {
  log('\nPhase 2: Migrating English classes...');

  const classes: UnifiedClass[] = [];
  const processedClasses = new Set<string>(); // Track processed class names
  const teachersSnapshot = await getDocs(collection(db, ENGLISH_SCHEDULES_COLLECTION));

  teachersSnapshot.forEach((teacherDoc) => {
    const teacherName = teacherDoc.id;
    const scheduleData = teacherDoc.data();

    Object.entries(scheduleData).forEach(([key, cellData]) => {
      const cell = cellData as EnglishScheduleCell;

      // Skip LAB classes
      if (LAB_CLASS_PATTERN.test(cell.className)) {
        return;
      }

      // Parse key to extract schedule info
      const [part1, part2, part3] = key.split('-');
      const periodId = part2 || part1;
      const day = part3 || part2;

      const groupKey = part3 ? key : `${teacherName}-${part1}-${part2}`;
      const group = groupMap.get(groupKey);

      const timestamp = new Date().toISOString();
      const scheduleSlot: ScheduleSlot = { day, periodId, teacher: teacherName };

      // Collect all class names
      const allClassNames = [cell.className];
      if (cell.merged) {
        allClassNames.push(...cell.merged.map(m => m.className));
      }

      allClassNames.forEach((className, index) => {
        // Skip if already processed
        if (processedClasses.has(className)) {
          return;
        }

        const isLeader = group && index === 0;
        const isMember = group && index > 0;

        const classId = generateClassId(className, teacherName, 'english');

        const unifiedClass: UnifiedClass = {
          id: classId,
          className,
          subject: 'english',
          teacher: teacherName,
          room: cell.room,
          schedule: [scheduleSlot],
          isActive: true,
          migratedFrom: 'english',
          originalDocId: teacherDoc.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        // Add group information
        if (group) {
          unifiedClass.classGroupId = group.groupId;
          if (isLeader) {
            unifiedClass.isGroupLeader = true;
            unifiedClass.groupMembers = group.members.map(memberName =>
              generateClassId(memberName, teacherName, 'english')
            );
          } else if (isMember) {
            unifiedClass.isGroupLeader = false;
          }
        }

        classes.push(unifiedClass);
        processedClasses.add(className);
      });
    });
  });

  log(`✅ Prepared ${classes.length} English classes`);
  return classes;
}

// ============================================================================
// Phase 3: Migrate Math Classes (No Grouping)
// ============================================================================

async function migrateMathClasses(): Promise<UnifiedClass[]> {
  log('\nPhase 3: Migrating Math classes...');

  const classes: UnifiedClass[] = [];
  const mathSnapshot = await getDocs(collection(db, MATH_CLASSES_COLLECTION));

  mathSnapshot.forEach((classDoc) => {
    const data = classDoc.data() as MathClass;
    const timestamp = new Date().toISOString();

    // Parse legacy schedule strings
    const schedule: ScheduleSlot[] = [];
    if (data.schedule && Array.isArray(data.schedule)) {
      data.schedule.forEach((scheduleStr) => {
        const slot = parseScheduleString(scheduleStr);
        if (slot) {
          schedule.push(slot);
        }
      });
    }

    const classId = generateClassId(data.className, data.teacher, 'math');

    const unifiedClass: UnifiedClass = {
      id: classId,
      className: data.className,
      subject: 'math',
      teacher: data.teacher,
      schedule,
      color: data.color,
      isActive: true,
      legacySchedule: data.schedule,
      migratedFrom: 'math',
      originalDocId: classDoc.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    classes.push(unifiedClass);
  });

  log(`✅ Prepared ${classes.length} Math classes`);
  return classes;
}

// ============================================================================
// Phase 4: Write to Firestore
// ============================================================================

async function writeClassesToFirestore(classes: UnifiedClass[]): Promise<void> {
  if (DRY_RUN) {
    log('\n🔍 DRY RUN MODE: Skipping Firestore writes');
    log(`   Would write ${classes.length} documents to ${CLASSES_COLLECTION}`);
    return;
  }

  log('\nPhase 4: Writing classes to Firestore...');

  let batch = writeBatch(db);
  let batchCount = 0;
  let totalWritten = 0;

  for (const classData of classes) {
    const classRef = doc(db, CLASSES_COLLECTION, classData.id);
    batch.set(classRef, classData);
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      totalWritten += batchCount;
      log(`   ✅ Committed batch: ${totalWritten}/${classes.length}`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalWritten += batchCount;
    log(`   ✅ Committed final batch: ${totalWritten}/${classes.length}`);
  }

  log(`✅ Successfully wrote ${totalWritten} classes to Firestore`);
}

// ============================================================================
// Phase 5: Validation & Statistics
// ============================================================================

async function validateAndReport(
  groupMap: Map<string, ClassGroup>,
  englishClasses: UnifiedClass[],
  mathClasses: UnifiedClass[]
): Promise<MigrationStats> {
  log('\nPhase 5: Validation & Statistics...');

  const stats: MigrationStats = {
    totalClasses: englishClasses.length + mathClasses.length,
    mathClasses: mathClasses.length,
    englishClasses: englishClasses.length,
    mergedGroups: groupMap.size,
    singleClasses: 0,
    largestGroup: { groupId: '', memberCount: 0 },
    errors: [],
  };

  // Find largest group
  for (const [groupId, group] of groupMap) {
    const totalMembers = 1 + group.members.length; // leader + members
    if (totalMembers > stats.largestGroup.memberCount) {
      stats.largestGroup = { groupId, memberCount: totalMembers };
    }
  }

  // Count single classes (English only, math doesn't have groups)
  stats.singleClasses = englishClasses.filter(c => !c.classGroupId).length;

  // Validate: Check for orphaned members (members without leader)
  const leaderGroups = new Set<string>();
  const memberGroups = new Set<string>();

  englishClasses.forEach(cls => {
    if (cls.classGroupId) {
      if (cls.isGroupLeader) {
        leaderGroups.add(cls.classGroupId);
      } else {
        memberGroups.add(cls.classGroupId);
      }
    }
  });

  // Find orphaned members
  memberGroups.forEach(groupId => {
    if (!leaderGroups.has(groupId)) {
      const error = `Orphaned members in group ${groupId}: missing leader`;
      stats.errors.push(error);
      error(error);
    }
  });

  // Report
  log('\n📊 Migration Statistics:');
  log(`   Total classes: ${stats.totalClasses}`);
  log(`   - Math: ${stats.mathClasses}`);
  log(`   - English: ${stats.englishClasses}`);
  log(`   Merged groups: ${stats.mergedGroups}`);
  log(`   Single classes (English): ${stats.singleClasses}`);
  log(`   Largest group: ${stats.largestGroup.groupId} (${stats.largestGroup.memberCount} classes)`);

  if (stats.errors.length > 0) {
    log(`\n⚠️  Validation Errors: ${stats.errors.length}`);
    stats.errors.forEach(err => log(`   - ${err}`));
  } else {
    log('\n✅ All validation checks passed');
  }

  return stats;
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function main() {
  const startTime = Date.now();

  log('========================================');
  log('Unified Classes Migration v2.0');
  log('========================================');
  log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (validation only)' : '🚀 LIVE (will write to Firestore)'}`);
  log(`Target collection: ${CLASSES_COLLECTION}`);
  log('========================================\n');

  try {
    // Phase 1: Identify merged groups
    const groupMap = await identifyMergedGroups();

    // Phase 2: Migrate English classes
    const englishClasses = await migrateEnglishClasses(groupMap);

    // Phase 3: Migrate Math classes
    const mathClasses = await migrateMathClasses();

    // Phase 4: Write to Firestore
    const allClasses = [...englishClasses, ...mathClasses];
    await writeClassesToFirestore(allClasses);

    // Phase 5: Validation & Statistics
    const stats = await validateAndReport(groupMap, englishClasses, mathClasses);

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('\n========================================');
    log(`✅ Migration completed in ${duration}s`);
    if (DRY_RUN) {
      log('ℹ️  This was a DRY RUN. No data was written.');
      log('   Run without --dry-run to execute migration.');
    } else {
      log(`✅ ${stats.totalClasses} classes written to ${CLASSES_COLLECTION}`);
    }
    log('========================================\n');

    if (stats.errors.length === 0) {
      process.exit(0);
    } else {
      log('⚠️  Migration completed with errors. Please review above.');
      process.exit(1);
    }

  } catch (err) {
    error('Migration failed:', err);
    process.exit(1);
  }
}

// Run migration
main();
