/**
 * Migration Script: teacherId (name) → staffId (actual ID)
 *
 * Phase 1: Analysis & Preview
 * - Analyze all enrollments
 * - Match teacherId (name) to staff documents
 * - Generate preview report
 *
 * Phase 2: Actual Migration
 * - Update all enrollment documents
 * - Add staffId field
 * - Keep teacherId for rollback safety (deprecated)
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  collectionGroup,
  doc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase config (same as main app)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface StaffMember {
  id: string;
  name: string;
  englishName?: string;
  [key: string]: any;
}

interface EnrollmentDoc {
  id: string;
  studentId: string;
  teacherId: string;
  className?: string;
  subject?: string;
  path: string;
}

interface MatchResult {
  enrollment: EnrollmentDoc;
  matchedStaff?: StaffMember;
  matchType?: 'exact-name' | 'exact-english' | 'partial-name' | 'partial-english' | 'none';
  confidence: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Step 1: Load all staff members
 */
async function loadStaff(): Promise<StaffMember[]> {
  console.log('📥 Loading staff data...');
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const staff = staffSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as StaffMember));

  console.log(`✅ Loaded ${staff.length} staff members`);
  staff.forEach(s => {
    console.log(`   - ${s.id}: ${s.name} (${s.englishName || 'no english name'})`);
  });

  return staff;
}

/**
 * Step 2: Load all enrollments
 */
async function loadEnrollments(): Promise<EnrollmentDoc[]> {
  console.log('\n📥 Loading all enrollments...');
  const enrollmentsSnapshot = await getDocs(collectionGroup(db, 'enrollments'));

  const enrollments: EnrollmentDoc[] = [];
  enrollmentsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const pathParts = doc.ref.path.split('/');
    const studentId = pathParts[1];

    enrollments.push({
      id: doc.id,
      studentId,
      teacherId: data.teacherId || '',
      className: data.className,
      subject: data.subject,
      path: doc.ref.path
    });
  });

  console.log(`✅ Loaded ${enrollments.length} enrollments`);

  return enrollments;
}

/**
 * Step 3: Match enrollments to staff
 */
function matchEnrollmentToStaff(
  enrollment: EnrollmentDoc,
  staff: StaffMember[]
): MatchResult {
  const teacherId = enrollment.teacherId;

  if (!teacherId) {
    return {
      enrollment,
      confidence: 'none'
    };
  }

  // 1. Exact match on name
  let matched = staff.find(s => s.name === teacherId);
  if (matched) {
    return {
      enrollment,
      matchedStaff: matched,
      matchType: 'exact-name',
      confidence: 'high'
    };
  }

  // 2. Exact match on englishName
  matched = staff.find(s => s.englishName === teacherId);
  if (matched) {
    return {
      enrollment,
      matchedStaff: matched,
      matchType: 'exact-english',
      confidence: 'high'
    };
  }

  // 3. Partial match on name (case-insensitive)
  matched = staff.find(s =>
    s.name.toLowerCase().includes(teacherId.toLowerCase()) ||
    teacherId.toLowerCase().includes(s.name.toLowerCase())
  );
  if (matched) {
    return {
      enrollment,
      matchedStaff: matched,
      matchType: 'partial-name',
      confidence: 'medium'
    };
  }

  // 4. Partial match on englishName
  matched = staff.find(s =>
    s.englishName && (
      s.englishName.toLowerCase().includes(teacherId.toLowerCase()) ||
      teacherId.toLowerCase().includes(s.englishName.toLowerCase())
    )
  );
  if (matched) {
    return {
      enrollment,
      matchedStaff: matched,
      matchType: 'partial-english',
      confidence: 'medium'
    };
  }

  // No match found
  return {
    enrollment,
    confidence: 'none'
  };
}

/**
 * Step 4: Generate preview report
 */
function generatePreviewReport(results: MatchResult[]): string {
  const report: string[] = [];

  report.push('='.repeat(80));
  report.push('MIGRATION PREVIEW REPORT: teacherId → staffId');
  report.push('='.repeat(80));
  report.push('');

  // Statistics
  const high = results.filter(r => r.confidence === 'high').length;
  const medium = results.filter(r => r.confidence === 'medium').length;
  const none = results.filter(r => r.confidence === 'none').length;

  report.push('📊 STATISTICS:');
  report.push(`   Total enrollments: ${results.length}`);
  report.push(`   ✅ High confidence matches: ${high} (${(high/results.length*100).toFixed(1)}%)`);
  report.push(`   ⚠️  Medium confidence matches: ${medium} (${(medium/results.length*100).toFixed(1)}%)`);
  report.push(`   ❌ No matches: ${none} (${(none/results.length*100).toFixed(1)}%)`);
  report.push('');

  // High confidence matches
  report.push('✅ HIGH CONFIDENCE MATCHES (Automatic):');
  report.push('-'.repeat(80));
  const highConfidence = results.filter(r => r.confidence === 'high');
  if (highConfidence.length === 0) {
    report.push('   (none)');
  } else {
    highConfidence.slice(0, 20).forEach(r => {
      report.push(`   ${r.enrollment.teacherId} → ${r.matchedStaff?.id} (${r.matchedStaff?.name})`);
      report.push(`      Path: ${r.enrollment.path}`);
      report.push(`      Type: ${r.matchType}`);
    });
    if (highConfidence.length > 20) {
      report.push(`   ... and ${highConfidence.length - 20} more`);
    }
  }
  report.push('');

  // Medium confidence matches
  report.push('⚠️  MEDIUM CONFIDENCE MATCHES (Need Review):');
  report.push('-'.repeat(80));
  const mediumConfidence = results.filter(r => r.confidence === 'medium');
  if (mediumConfidence.length === 0) {
    report.push('   (none)');
  } else {
    mediumConfidence.forEach(r => {
      report.push(`   ${r.enrollment.teacherId} → ${r.matchedStaff?.id} (${r.matchedStaff?.name})`);
      report.push(`      Path: ${r.enrollment.path}`);
      report.push(`      Type: ${r.matchType}`);
    });
  }
  report.push('');

  // No matches
  report.push('❌ NO MATCHES (Manual Intervention Required):');
  report.push('-'.repeat(80));
  const noMatches = results.filter(r => r.confidence === 'none');
  if (noMatches.length === 0) {
    report.push('   (none)');
  } else {
    // Group by teacherId
    const grouped = new Map<string, EnrollmentDoc[]>();
    noMatches.forEach(r => {
      const key = r.enrollment.teacherId || '(empty)';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(r.enrollment);
    });

    grouped.forEach((enrollments, teacherId) => {
      report.push(`   teacherId: "${teacherId}" (${enrollments.length} enrollments)`);
      enrollments.slice(0, 3).forEach(e => {
        report.push(`      - ${e.path}`);
      });
      if (enrollments.length > 3) {
        report.push(`      ... and ${enrollments.length - 3} more`);
      }
    });
  }
  report.push('');

  report.push('='.repeat(80));
  report.push('NEXT STEPS:');
  report.push('1. Review medium confidence matches');
  report.push('2. Manually fix no-match cases');
  report.push('3. Run actual migration script');
  report.push('='.repeat(80));

  return report.join('\n');
}

/**
 * Main: Preview mode
 */
async function runPreview() {
  try {
    console.log('🚀 Starting migration preview...\n');

    // Load data
    const staff = await loadStaff();
    const enrollments = await loadEnrollments();

    // Match
    console.log('\n🔍 Matching enrollments to staff...');
    const results = enrollments.map(e => matchEnrollmentToStaff(e, staff));
    console.log('✅ Matching complete\n');

    // Generate report
    const report = generatePreviewReport(results);

    // Save to file
    const reportPath = path.join(__dirname, 'migration-preview-report.txt');
    fs.writeFileSync(reportPath, report);

    console.log(report);
    console.log(`\n📄 Full report saved to: ${reportPath}`);

  } catch (error) {
    console.error('❌ Error during preview:', error);
    process.exit(1);
  }
}

/**
 * Main: Actual migration
 */
async function runMigration(dryRun: boolean = true) {
  try {
    console.log(`🚀 Starting ${dryRun ? 'DRY RUN' : 'ACTUAL'} migration...\n`);

    // Load data
    const staff = await loadStaff();
    const enrollments = await loadEnrollments();

    // Match
    console.log('\n🔍 Matching enrollments to staff...');
    const results = enrollments.map(e => matchEnrollmentToStaff(e, staff));

    // Filter only high confidence
    const toMigrate = results.filter(r => r.confidence === 'high');
    const skipped = results.filter(r => r.confidence !== 'high');

    console.log(`✅ ${toMigrate.length} enrollments ready to migrate`);
    console.log(`⚠️  ${skipped.length} enrollments skipped (not high confidence)`);

    if (!dryRun) {
      console.log('\n⚙️  Updating Firestore documents...');

      let batch = writeBatch(db);
      let batchCount = 0;
      let totalUpdated = 0;

      for (const result of toMigrate) {
        const docRef = doc(db, result.enrollment.path);

        batch.update(docRef, {
          staffId: result.matchedStaff!.id,
          // Keep teacherId for rollback safety (mark as deprecated)
          teacherId_deprecated: result.enrollment.teacherId,
          migrated: true,
          migratedAt: new Date().toISOString()
        });

        batchCount++;

        // Firestore batch limit: 500 operations
        if (batchCount === 500) {
          await batch.commit();
          totalUpdated += batchCount;
          console.log(`   ✅ Committed batch (${totalUpdated}/${toMigrate.length})`);
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
        totalUpdated += batchCount;
        console.log(`   ✅ Committed final batch (${totalUpdated}/${toMigrate.length})`);
      }

      console.log(`\n✅ Migration complete! Updated ${totalUpdated} documents`);
    } else {
      console.log('\n🔍 DRY RUN - No changes made to Firestore');
      console.log('   To run actual migration, use: npm run migrate:teacher-id -- --actual');
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// CLI
const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--preview' || !mode) {
  runPreview();
} else if (mode === '--dry-run') {
  runMigration(true);
} else if (mode === '--actual') {
  console.log('⚠️  WARNING: This will modify Firestore data!');
  console.log('⚠️  Make sure you have a backup!');
  console.log('⚠️  Starting in 5 seconds... (Ctrl+C to cancel)');
  setTimeout(() => runMigration(false), 5000);
} else {
  console.log('Usage:');
  console.log('  npm run migrate:teacher-id              # Preview mode (default)');
  console.log('  npm run migrate:teacher-id -- --preview # Preview mode');
  console.log('  npm run migrate:teacher-id -- --dry-run # Dry run (no changes)');
  console.log('  npm run migrate:teacher-id -- --actual  # Actual migration');
}
