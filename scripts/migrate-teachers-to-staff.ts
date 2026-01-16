/**
 * migrate-teachers-to-staff.ts
 *
 * Migration script to migrate teachers from '강사목록' collection to 'staff' collection
 *
 * Usage:
 *   npm run migrate:teachers -- --dry-run  (Preview migration)
 *   npm run migrate:teachers                (Execute migration)
 *   npm run migrate:teachers -- --rollback  (Rollback migration)
 *
 * Features:
 * - Maps Teacher fields to StaffMember fields
 * - Prevents duplicates by checking existing names
 * - Creates backup JSON file before migration
 * - Supports dry-run mode
 * - Supports rollback from backup
 */

import {
    collection,
    getDocs,
    doc,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../firebaseConfig.js';
import { Teacher, StaffMember } from '../types.js';

const COL_TEACHERS = '강사목록';
const COL_STAFF = 'staff';
const BACKUP_DIR = './backups';
const BACKUP_FILENAME = 'teachers-backup.json';

interface MigrationResult {
    totalTeachers: number;
    migratedCount: number;
    skippedCount: number;
    errors: string[];
}

interface BackupData {
    timestamp: string;
    teachers: (Teacher & { firestoreId: string })[];
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
    if (!existsSync(BACKUP_DIR)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`Created backup directory: ${BACKUP_DIR}`);
    }
}

/**
 * Create backup of teachers collection
 */
async function backupTeachers(): Promise<void> {
    console.log('\n📦 Creating backup of teachers collection...');
    ensureBackupDir();

    const teachersSnapshot = await getDocs(collection(db, COL_TEACHERS));
    const teachers: (Teacher & { firestoreId: string })[] = [];

    teachersSnapshot.forEach((docSnap) => {
        teachers.push({
            firestoreId: docSnap.id,
            ...(docSnap.data() as Teacher)
        });
    });

    const backupData: BackupData = {
        timestamp: new Date().toISOString(),
        teachers: teachers
    };

    const backupPath = join(BACKUP_DIR, BACKUP_FILENAME);
    writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`   Total teachers backed up: ${teachers.length}`);
}

/**
 * Load backup data
 */
function loadBackup(): BackupData | null {
    const backupPath = join(BACKUP_DIR, BACKUP_FILENAME);

    if (!existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupPath}`);
        return null;
    }

    try {
        const data = readFileSync(backupPath, 'utf-8');
        return JSON.parse(data) as BackupData;
    } catch (error) {
        console.error('❌ Failed to load backup:', error);
        return null;
    }
}

/**
 * Map Teacher to StaffMember
 */
function mapTeacherToStaff(teacher: Teacher): Omit<StaffMember, 'id'> {
    const now = new Date().toISOString();
    const today = now.split('T')[0]; // YYYY-MM-DD format

    // Map subjects: string[] -> ('math' | 'english')[]
    let mappedSubjects: ('math' | 'english')[] | undefined = undefined;
    if (teacher.subjects && teacher.subjects.length > 0) {
        mappedSubjects = teacher.subjects
            .map(s => {
                const lower = s.toLowerCase();
                if (lower.includes('수학') || lower.includes('math')) return 'math';
                if (lower.includes('영어') || lower.includes('english')) return 'english';
                return null;
            })
            .filter(Boolean) as ('math' | 'english')[];

        if (mappedSubjects.length === 0) {
            mappedSubjects = undefined;
        }
    }

    return {
        name: teacher.name,
        email: '', // To be filled later
        phone: '', // To be filled later
        role: 'teacher',
        subjects: mappedSubjects,
        hireDate: today,
        status: 'active',

        // Teacher-specific fields
        isHiddenInTimetable: teacher.isHidden || false,
        isNative: teacher.isNative || false,
        bgColor: teacher.bgColor,
        textColor: teacher.textColor,
        defaultRoom: teacher.defaultRoom,
        timetableOrder: teacher.order,

        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Check if staff member with same name already exists
 */
async function staffExists(name: string): Promise<boolean> {
    const q = query(collection(db, COL_STAFF), where('name', '==', name));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

/**
 * Main migration function
 */
async function migrateTeachersToStaff(dryRun: boolean = true): Promise<MigrationResult> {
    const result: MigrationResult = {
        totalTeachers: 0,
        migratedCount: 0,
        skippedCount: 0,
        errors: []
    };

    try {
        console.log(`\n=== Teacher to Staff Migration ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

        // 1. Create backup (only in live mode)
        if (!dryRun) {
            await backupTeachers();
        }

        // 2. Fetch all teachers
        const teachersSnapshot = await getDocs(collection(db, COL_TEACHERS));
        result.totalTeachers = teachersSnapshot.size;
        console.log(`Found ${result.totalTeachers} teachers in ${COL_TEACHERS}`);

        if (result.totalTeachers === 0) {
            console.log('No teachers to migrate.');
            return result;
        }

        // 3. Check for existing staff and prepare migration
        const teachersToMigrate: { id: string; teacher: Teacher; staffData: Omit<StaffMember, 'id'> }[] = [];

        for (const docSnap of teachersSnapshot.docs) {
            const teacher = { id: docSnap.id, ...docSnap.data() } as Teacher;

            // Check if already exists in staff
            const exists = await staffExists(teacher.name);

            if (exists) {
                console.log(`⏭️  Skipping: ${teacher.name} (already exists in staff)`);
                result.skippedCount++;
            } else {
                const staffData = mapTeacherToStaff(teacher);
                teachersToMigrate.push({ id: docSnap.id, teacher, staffData });
            }
        }

        console.log(`\n📊 Migration Summary:`);
        console.log(`   Total teachers: ${result.totalTeachers}`);
        console.log(`   To migrate: ${teachersToMigrate.length}`);
        console.log(`   To skip (duplicates): ${result.skippedCount}`);

        // 4. Preview or Execute Migration
        if (dryRun) {
            console.log(`\n[DRY RUN] Would migrate the following teachers:`);
            teachersToMigrate.forEach(({ teacher, staffData }) => {
                console.log(`\n  📝 ${teacher.name}`);
                console.log(`     - Role: teacher`);
                console.log(`     - Subjects: ${staffData.subjects?.join(', ') || 'none'}`);
                console.log(`     - Native: ${staffData.isNative ? 'Yes' : 'No'}`);
                console.log(`     - Hidden: ${staffData.isHiddenInTimetable ? 'Yes' : 'No'}`);
                console.log(`     - Default Room: ${staffData.defaultRoom || 'none'}`);
                console.log(`     - Colors: bg=${staffData.bgColor || 'none'}, text=${staffData.textColor || 'none'}`);
            });

            result.migratedCount = teachersToMigrate.length;
        } else {
            // Execute migration
            console.log(`\n🚀 Starting migration...`);

            const batch = writeBatch(db);
            let batchCount = 0;
            const MAX_BATCH_SIZE = 500;

            for (const { id, teacher, staffData } of teachersToMigrate) {
                // Use same ID from teachers collection for consistency
                const staffDocRef = doc(db, COL_STAFF, id);
                batch.set(staffDocRef, staffData);
                batchCount++;
                result.migratedCount++;

                console.log(`  ✅ Migrating: ${teacher.name}`);

                if (batchCount >= MAX_BATCH_SIZE) {
                    await batch.commit();
                    console.log(`   Committed batch of ${batchCount} staff members`);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                console.log(`   Committed final batch of ${batchCount} staff members`);
            }

            console.log(`\n✅ Migration complete! ${result.migratedCount} teachers migrated to staff.`);
            console.log(`\n💡 Note: Original teachers collection (${COL_TEACHERS}) is preserved.`);
            console.log(`   You can safely delete it after verifying the migration.`);
        }

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(errMsg);
        console.error('❌ Migration error:', errMsg);
    }

    return result;
}

/**
 * Rollback migration by restoring from backup
 */
async function rollbackMigration(): Promise<void> {
    console.log('\n=== Rollback Migration ===\n');

    const backup = loadBackup();
    if (!backup) {
        console.error('Cannot proceed with rollback.');
        return;
    }

    console.log(`📦 Backup found from: ${backup.timestamp}`);
    console.log(`   Teachers in backup: ${backup.teachers.length}`);

    // Get list of staff members that were migrated (role = 'teacher')
    console.log('\n🔍 Finding migrated staff members...');
    const staffQuery = query(collection(db, COL_STAFF), where('role', '==', 'teacher'));
    const staffSnapshot = await getDocs(staffQuery);

    console.log(`   Found ${staffSnapshot.size} staff members with role='teacher'`);

    if (staffSnapshot.size === 0) {
        console.log('No staff members to rollback.');
        return;
    }

    // Confirm deletion
    console.log('\n⚠️  This will DELETE all staff members with role="teacher"');
    console.log('   Original teachers collection will remain unchanged.');

    // Delete migrated staff members
    console.log('\n🗑️  Deleting migrated staff members...');
    const batch = writeBatch(db);
    let deleteCount = 0;

    staffSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleteCount++;
        const staffData = docSnap.data() as StaffMember;
        console.log(`  ❌ Deleting: ${staffData.name}`);
    });

    await batch.commit();
    console.log(`\n✅ Rollback complete! Deleted ${deleteCount} staff members.`);
    console.log(`   Teachers collection (${COL_TEACHERS}) remains intact.`);
}

/**
 * CLI Entry Point
 */
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isRollback = args.includes('--rollback');

    if (isRollback) {
        await rollbackMigration();
    } else {
        await migrateTeachersToStaff(isDryRun);

        if (isDryRun) {
            console.log('\n💡 To execute the migration, run without --dry-run flag:');
            console.log('   npm run migrate:teachers');
        }
    }

    process.exit(0);
}

// Run if executed directly (Node.js ESM detection)
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename || process.argv[1].endsWith('migrate-teachers-to-staff.ts');

if (isMainModule) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

// Export for testing or programmatic use
export { migrateTeachersToStaff, rollbackMigration, mapTeacherToStaff };
