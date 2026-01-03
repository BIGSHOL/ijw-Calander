/**
 * Migration Script: Gantt Projects Phase 10 Upgrade
 * 
 * This script migrates existing gantt_templates to the new Phase 10 schema:
 * - Adds ownerId (defaults to createdBy)
 * - Adds visibility (defaults to 'private' or 'public' based on isShared)
 * - Converts assignees to members array with 'viewer' role
 * - Initializes empty departmentIds array
 * 
 * Usage:
 * 1. Import this script in a Node.js environment with Firebase Admin SDK
 * 2. Run: npx ts-node scripts/migrateGanttProjects.ts
 * 
 * Or run from browser console with authenticated user (master/admin role)
 */

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttTemplate, ProjectMember, ProjectVisibility } from '../types';

interface MigrationStats {
    total: number;
    migrated: number;
    skipped: number;
    errors: number;
}

/**
 * Migrate all gantt_templates to Phase 10 schema
 */
export async function migrateGanttProjects(): Promise<MigrationStats> {
    console.log('🚀 Starting Gantt projects migration to Phase 10...');
    console.log('---------------------------------------------------');

    const stats: MigrationStats = {
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: 0
    };

    try {
        const snapshot = await getDocs(collection(db, 'gantt_templates'));
        stats.total = snapshot.size;
        console.log(`📊 Found ${stats.total} projects to process`);

        const batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnapshot of snapshot.docs) {
            try {
                const project = docSnapshot.data() as any;

                // Skip if already migrated (has members array and visibility field)
                if (project.members && Array.isArray(project.members) && project.visibility) {
                    console.log(`⏭️ Skipped: ${project.title || docSnapshot.id} (already migrated)`);
                    stats.skipped++;
                    continue;
                }

                // Determine visibility based on legacy fields
                let visibility: ProjectVisibility = 'private';
                if (project.isShared === true) {
                    visibility = 'public';
                }

                // Convert assignees to members with 'viewer' role
                const members: ProjectMember[] = [];

                // Add creator as owner
                if (project.createdBy) {
                    members.push({
                        userId: project.createdBy,
                        userName: project.createdByEmail?.split('@')[0] || 'Unknown',
                        userEmail: project.createdByEmail || '',
                        role: 'owner',
                        addedAt: project.createdAt?.toMillis?.() || Date.now(),
                        addedBy: project.createdBy
                    });
                }

                // Add assignees as viewers (excluding creator to avoid duplicates)
                if (project.assignees && Array.isArray(project.assignees)) {
                    for (const assigneeId of project.assignees) {
                        if (assigneeId === project.createdBy) continue; // Skip duplicate

                        members.push({
                            userId: assigneeId,
                            userName: 'User', // Will be resolved on client
                            userEmail: '',
                            role: 'viewer',
                            addedAt: Date.now(),
                            addedBy: project.createdBy || ''
                        });
                    }
                }

                // Prepare update data
                const updates: Partial<GanttTemplate> = {
                    ownerId: project.ownerId || project.createdBy,
                    visibility: visibility,
                    members: members,
                    departmentIds: project.departmentIds || [],
                    isArchived: project.isArchived || false,
                    lastModifiedAt: Date.now(),
                    lastModifiedBy: 'migration-script'
                };

                batch.update(doc(db, 'gantt_templates', docSnapshot.id), updates);
                batchCount++;
                stats.migrated++;

                console.log(`✅ Migrated: ${project.title || docSnapshot.id}`);
                console.log(`   - Visibility: ${visibility}`);
                console.log(`   - Members: ${members.length}`);

                // Firestore batch limit is 500 operations
                if (batchCount >= 500) {
                    await batch.commit();
                    console.log(`📦 Committed batch of ${batchCount} updates`);
                    batchCount = 0;
                }
            } catch (error) {
                console.error(`❌ Error migrating ${docSnapshot.id}:`, error);
                stats.errors++;
            }
        }

        // Commit remaining updates
        if (batchCount > 0) {
            await batch.commit();
            console.log(`📦 Committed final batch of ${batchCount} updates`);
        }

        console.log('');
        console.log('===================================================');
        console.log('🎉 Migration Complete!');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Migrated: ${stats.migrated}`);
        console.log(`   Skipped: ${stats.skipped}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log('===================================================');

        return stats;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

/**
 * Rollback migration - removes Phase 10 fields
 */
export async function rollbackMigration(): Promise<void> {
    console.log('⏪ Rolling back Gantt migration...');

    const snapshot = await getDocs(collection(db, 'gantt_templates'));
    const batch = writeBatch(db);
    let count = 0;

    for (const docSnapshot of snapshot.docs) {
        // Note: Firestore doesn't support deleteField in batch with regular syntax
        // We set fields to null which effectively removes them in most cases
        batch.update(doc(db, 'gantt_templates', docSnapshot.id), {
            members: null,
            visibility: null,
            ownerId: null,
            departmentIds: null,
            primaryDepartmentId: null,
            isArchived: null,
            lastModifiedBy: null,
            lastModifiedAt: null
        });
        count++;

        if (count >= 500) {
            await batch.commit();
            console.log(`⏪ Rolled back ${count} projects...`);
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`✅ Rollback complete!`);
}

/**
 * Preview migration without making changes
 */
export async function previewMigration(): Promise<void> {
    console.log('👀 Preview Migration (dry run)');
    console.log('------------------------------');

    const snapshot = await getDocs(collection(db, 'gantt_templates'));
    let needsMigration = 0;
    let alreadyMigrated = 0;

    for (const docSnapshot of snapshot.docs) {
        const project = docSnapshot.data() as any;

        if (project.members && Array.isArray(project.members) && project.visibility) {
            alreadyMigrated++;
            console.log(`✅ ${project.title || docSnapshot.id} - Already migrated`);
        } else {
            needsMigration++;
            const visibility = project.isShared ? 'public' : 'private';
            const assigneeCount = project.assignees?.length || 0;
            console.log(`⏳ ${project.title || docSnapshot.id} - Needs migration`);
            console.log(`   Will set: visibility=${visibility}, assignees→${assigneeCount + 1} members`);
        }
    }

    console.log('');
    console.log(`Summary: ${needsMigration} need migration, ${alreadyMigrated} already done`);
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    (window as any).migrateGanttProjects = migrateGanttProjects;
    (window as any).rollbackMigration = rollbackMigration;
    (window as any).previewMigration = previewMigration;
}
